import json
import traceback

from dotenv import load_dotenv

from db import (
    add_research_source,
    create_firecrawl_job,
    create_research_task,
    create_segment,
    get_segments_for_topic,
    get_topic,
    link_segment_sources,
    update_firecrawl_job,
    update_research_task,
    update_segment,
    update_topic,
)


def get_segment(seg_id):
    from db import get_conn
    conn = get_conn()
    row = conn.execute("SELECT * FROM segments WHERE id = ?", (seg_id,)).fetchone()
    conn.close()
    return dict(row) if row else None
from keystore import get_key

load_dotenv()

BUSY_STATUSES = ("researching", "ready")


def _get_openai():
    from openai import OpenAI
    api_key = get_key("openai")
    return OpenAI(api_key=api_key) if api_key else OpenAI()


def _get_firecrawl():
    from firecrawl import Firecrawl
    api_key = get_key("firecrawl")
    if not api_key:
        raise ValueError("Firecrawl API key not set. Add it in Settings.")
    return Firecrawl(api_key=api_key)


def _is_segment_busy(seg):
    return seg["status"] in BUSY_STATUSES


def _build_source_context(topic_id, per_source_limit=600, total_limit=8000,
                           source_ids_filter=None):
    """Fetch sources and build a context string. Returns (context, source_ids_used)."""
    from db import get_conn
    conn = get_conn()
    if source_ids_filter:
        placeholders = ",".join("?" for _ in source_ids_filter)
        rows = conn.execute(
            f"SELECT id, url, title, content FROM research_sources "
            f"WHERE id IN ({placeholders}) ORDER BY created_at",
            source_ids_filter,
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, url, title, content FROM research_sources "
            "WHERE topic_id = ? ORDER BY created_at DESC",
            (topic_id,),
        ).fetchall()
    conn.close()

    context = ""
    source_ids_used = []
    for row in rows:
        text = (row["content"] or "")[:per_source_limit]
        title = row["title"] or ""
        url = row["url"] or ""
        context += f"\n--- {title} ({url}) ---\n{text}\n"
        source_ids_used.append(row["id"])
        if len(context) > total_limit:
            break
    return context, source_ids_used


def _desc_line(description):
    if description:
        return f'\nTopic description: "{description}"\n'
    return ""


def _synthesize_segment(topic_id, segment_id, source="firecrawl",
                         description=""):
    """Synthesize a segment using ALL topic sources. Links sources via join table."""
    context, source_ids = _build_source_context(topic_id)
    if not context:
        print("[FC] No sources to synthesize from, resetting to draft")
        update_segment(segment_id, status="draft")
        return

    topic = get_topic(topic_id)
    seg = get_segment(segment_id)
    if not seg:
        return

    update_segment(segment_id, status="researching")
    client = _get_openai()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": (
            f'Using this researched information, write one short-form video segment.\n'
            f'Series: "{topic["title"]}"\nSegment: "{seg["title"]}"\n'
            f'{_desc_line(description or topic.get("description", ""))}\n'
            f'Research:\n{context}\n\n'
            f'Return JSON: {{"hook": "1-2 sentence attention grabber", '
            f'"script": "3-5 sentence educational content", '
            f'"visual_cue": "what should be shown on screen"}}'
        )}],
        response_format={"type": "json_object"},
    )
    data = json.loads(response.choices[0].message.content)
    update_segment(segment_id, hook=data["hook"], script=data["script"],
                   visual_cue=data.get("visual_cue", ""), source=source,
                   status="ready")
    link_segment_sources(segment_id, source_ids)


def generate_series_outline(topic_id, topic_title, num_segments=6,
                             description="", instruction=""):
    """Create new segments with titles. Always appends — never skips existing."""
    existing = get_segments_for_topic(topic_id)
    next_num = max((s["segment_num"] for s in existing), default=0) + 1

    task_id = create_research_task(topic_id, "outline", topic_title)
    try:
        update_research_task(task_id, status="running")
        client = _get_openai()

        desc_line = ""
        if description:
            desc_line = f'\nTopic description: "{description}"\n'
        instr_line = ""
        if instruction:
            instr_line = f'\nSpecific instruction: "{instruction}"\n'

        existing_titles = [s["title"] for s in existing if s.get("title")]
        existing_note = ""
        if existing_titles:
            existing_note = (f'\nExisting segments (create NEW ones, avoid overlap): '
                           f'{existing_titles}\n')

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": (
                f'Create a {num_segments}-part short-form video series outline '
                f'about "{topic_title}".\n'
                f'{desc_line}{instr_line}{existing_note}\n'
                f'Return JSON: '
                f'{{"series_title": "...", "segments": '
                f'[{{"num": 1, "title": "catchy title"}}]}}'
            )}],
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)

        if not existing:
            update_topic(topic_id,
                         series_title=data.get("series_title", topic_title),
                         research_status="outline_done")

        for i, seg in enumerate(data["segments"]):
            create_segment(topic_id, next_num + i, title=seg["title"])

        update_topic(topic_id,
                     total_segments=next_num + len(data["segments"]) - 1)
        update_research_task(task_id, status="done",
                             result=json.dumps(data, ensure_ascii=False))
        return data
    except Exception as exc:
        update_research_task(task_id, status="failed", error=str(exc))
        raise


def generate_segment_content(topic_id, segment_id, topic_title, segment_title,
                              description=""):
    """Generate AI content for a single segment, using all topic sources as context."""
    task_id = create_research_task(topic_id, "ai_generate", segment_title)
    try:
        update_segment(segment_id, status="researching")
        update_research_task(task_id, status="running")

        context, source_ids = _build_source_context(topic_id)
        research_block = f"\nAvailable research:\n{context}\n" if context else ""

        client = _get_openai()
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": (
                f'Write content for one short-form educational video.\n'
                f'Series: "{topic_title}"\nSegment: "{segment_title}"\n'
                f'{_desc_line(description)}{research_block}\n'
                f'Return JSON: {{"hook": "1-2 sentence attention grabber", '
                f'"script": "3-5 sentence educational content", '
                f'"visual_cue": "what should be shown on screen"}}'
            )}],
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)
        update_segment(segment_id, hook=data["hook"], script=data["script"],
                       visual_cue=data.get("visual_cue", ""),
                       source="ai", status="ready")
        if source_ids:
            link_segment_sources(segment_id, source_ids)
        update_research_task(task_id, status="done",
                             result=json.dumps(data, ensure_ascii=False))
        return data
    except Exception as exc:
        update_segment(segment_id, status="failed")
        update_research_task(task_id, status="failed", error=str(exc))
        raise


def research_with_firecrawl(topic_id, segment_id, topic_title, segment_title,
                             description=""):
    task_id = create_research_task(topic_id, "web_search",
                                   f"{topic_title}: {segment_title}")
    try:
        update_segment(segment_id, status="researching")
        update_research_task(task_id, status="searching")
        print(f"[FC] Searching: {topic_title} - {segment_title}")
        fc = _get_firecrawl()

        # Use description in query if available
        query_parts = [topic_title, segment_title, "educational facts"]
        if description:
            query_parts.insert(1, description[:60])
        query = " ".join(query_parts)

        results = fc.search(query, limit=5,
                            scrape_options={"formats": ["markdown"]})
        src_count = 0
        source_ids = []
        items = []
        if hasattr(results, "web") and results.web:
            items = results.web
        elif hasattr(results, "data") and results.data:
            items = results.data
        elif isinstance(results, list):
            items = results
        else:
            print(f"[FC] Unknown result: {type(results)} "
                  f"attrs={list(vars(results).keys()) if hasattr(results, '__dict__') else 'N/A'}")

        for item in items:
            url = getattr(item, "url", "") or ""
            title = getattr(item, "title", "") or ""
            if not title and hasattr(item, "metadata") and item.metadata:
                title = getattr(item.metadata, "title", "") or ""
            markdown = getattr(item, "markdown", "") or ""
            desc = getattr(item, "description", "") or ""
            if not title and url:
                try:
                    from urllib.parse import urlparse
                    title = urlparse(url).netloc
                except Exception:
                    title = url[:60]
            content = markdown or desc
            if content:
                sid = add_research_source(topic_id, url, title,
                                          content[:5000], "search")
                source_ids.append(sid)
                src_count += 1
            elif url:
                sid = add_research_source(topic_id, url, title or url,
                                          desc or f"Source: {url}", "search")
                source_ids.append(sid)
                src_count += 1
        print(f"[FC] Found {src_count} sources for: {segment_title}")

        update_research_task(task_id, status="processing")
        print(f"[FC] Synthesizing segment: {segment_title}")
        _synthesize_segment(topic_id, segment_id, "firecrawl",
                           description=description)
        update_research_task(task_id, status="done")
        print(f"[FC] Done: {segment_title}")
    except Exception as exc:
        print(f"[FC] ERROR: {segment_title}: {exc}")
        traceback.print_exc()
        update_segment(segment_id, status="failed")
        update_research_task(task_id, status="failed", error=str(exc))
        raise


def generate_all_ai(topic_id, topic_title, num_segments=6,
                     description="", instruction=""):
    update_topic(topic_id, research_status="generating")
    generate_series_outline(topic_id, topic_title, num_segments,
                           description=description, instruction=instruction)
    segments = get_segments_for_topic(topic_id)
    # Only process the newly created segments (not already ready/researching)
    for seg in segments:
        if _is_segment_busy(seg):
            continue
        try:
            generate_segment_content(topic_id, seg["id"], topic_title,
                                     seg["title"], description=description)
        except Exception:
            pass
    _check_all_done(topic_id)


def research_all_firecrawl(topic_id, topic_title, num_segments=6,
                            description="", instruction=""):
    print(f"[FC] Starting research_all for: {topic_title}")
    update_topic(topic_id, research_status="generating")
    generate_series_outline(topic_id, topic_title, num_segments,
                           description=description, instruction=instruction)
    segments = get_segments_for_topic(topic_id)
    print(f"[FC] Got {len(segments)} segments")
    for seg in segments:
        if _is_segment_busy(seg):
            print(f"[FC] Skipping busy: {seg['title']}")
            continue
        try:
            research_with_firecrawl(topic_id, seg["id"], topic_title,
                                     seg["title"], description=description)
        except Exception as exc:
            print(f"[FC] Segment failed: {seg['title']}: {exc}")
    _check_all_done(topic_id)
    print(f"[FC] All done for: {topic_title}")


def generate_segments_from_sources(topic_id, topic_title, source_ids,
                                    num_segments=0):
    task_id = create_research_task(topic_id, "source_to_segments",
                                   f"{len(source_ids)} sources")
    try:
        update_research_task(task_id, status="running")
        combined, _ = _build_source_context(
            topic_id, per_source_limit=1500,
            source_ids_filter=source_ids)

        if not combined.strip():
            update_research_task(task_id, status="failed",
                                 error="No source content found")
            return

        existing = get_segments_for_topic(topic_id)
        existing_titles = [s["title"].lower() for s in existing if s.get("title")]

        topic = get_topic(topic_id)

        auto_count = (f"Create exactly {num_segments} segments."
                      if num_segments > 0
                      else "Create an appropriate number of segments (3-8).")

        client = _get_openai()
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": (
                f'Using these research sources, create video segments for '
                f'a series about "{topic_title}".\n'
                f'{_desc_line(topic.get("description", ""))}\n'
                f'Existing segment titles (DO NOT duplicate): '
                f'{existing_titles}\n\n'
                f'{auto_count} Each segment must have a unique angle.\n\n'
                f'Sources:\n{combined}\n\n'
                f'Return JSON: {{"segments": [{{"title": "...", '
                f'"hook": "1-2 sentence attention grabber", '
                f'"script": "3-5 sentence educational content", '
                f'"visual_cue": "what to show on screen"}}]}}'
            )}],
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)

        next_num = max((s["segment_num"] for s in existing), default=0) + 1
        created = 0

        for seg_data in data.get("segments", []):
            title = seg_data.get("title", "")
            if title.lower() in existing_titles:
                print(f"[FC] Skipping duplicate: {title}")
                continue
            seg_id = create_segment(
                topic_id, next_num + created, title=title)
            update_segment(
                seg_id,
                hook=seg_data.get("hook", ""),
                script=seg_data.get("script", ""),
                visual_cue=seg_data.get("visual_cue", ""),
                source="firecrawl",
                status="ready",
            )
            # Link sources to this segment
            link_segment_sources(seg_id, source_ids)
            created += 1
            existing_titles.append(title.lower())

        update_topic(topic_id, total_segments=next_num + created - 1)
        update_research_task(
            task_id, status="done",
            result=f"Created {created} segments from {len(source_ids)} sources")
        print(f"[FC] Created {created} segments from {len(source_ids)} sources")

    except Exception as exc:
        print(f"[FC] generate_from_sources ERROR: {exc}")
        update_research_task(task_id, status="failed", error=str(exc))


def _check_all_done(topic_id):
    segments = get_segments_for_topic(topic_id)
    ready = sum(1 for s in segments if s["status"] == "ready")
    if ready == len(segments):
        update_topic(topic_id, research_status="done")
    else:
        update_topic(topic_id, research_status="partial")


# --- Firecrawl Power Functions ---

def fc_search(topic_id, segment_id, query, limit=5):
    job_id = create_firecrawl_job(topic_id, "search", query,
                                   segment_id=segment_id)
    try:
        fc = _get_firecrawl()
        results = fc.search(query, limit=limit,
                            scrape_options={"formats": ["markdown"]})
        total = 0
        items = getattr(results, "web", None) or getattr(results, "data", None) or []
        for item in items:
            url = getattr(item, "url", "") or ""
            title = getattr(item, "title", "") or ""
            md = getattr(item, "markdown", "") or getattr(item, "description", "") or ""
            if md:
                add_research_source(topic_id, url, title, md[:5000], "search")
                total += 1
        update_firecrawl_job(
            job_id, status="done", pages_found=total,
            result_preview=f"Found {total} results")
        return {"total": total}
    except Exception as exc:
        update_firecrawl_job(job_id, status="failed", error=str(exc))
        raise


def fc_scrape(topic_id, segment_id, url):
    job_id = create_firecrawl_job(topic_id, "scrape", url,
                                   segment_id=segment_id)
    try:
        fc = _get_firecrawl()
        result = fc.scrape(url, formats=["markdown"])
        md = getattr(result, "markdown", "") or ""
        title = ""
        if hasattr(result, "metadata") and result.metadata:
            title = getattr(result.metadata, "title", "") or ""
        add_research_source(topic_id, url, title, md[:5000], "scrape")
        preview = f"Scraped: {title[:80]}" if title else f"Scraped {url[:80]}"
        update_firecrawl_job(job_id, status="done", pages_found=1,
                             result_preview=preview)
        return {"url": url, "title": title}
    except Exception as exc:
        update_firecrawl_job(job_id, status="failed", error=str(exc))
        raise


def fc_extract(topic_id, segment_id, url, extract_prompt):
    config = json.dumps({"prompt": extract_prompt})
    job_id = create_firecrawl_job(topic_id, "extract", url,
                                   segment_id=segment_id, config=config)
    try:
        fc = _get_firecrawl()
        result = fc.scrape(
            url, formats=[{"type": "json", "prompt": extract_prompt}])
        json_data = getattr(result, "json", None) or {}
        content = json.dumps(json_data, ensure_ascii=False, indent=2)
        title = f"Extract: {extract_prompt[:60]}"
        add_research_source(topic_id, url, title, content, "extract")
        update_firecrawl_job(job_id, status="done", pages_found=1,
                             result_preview=content[:500])
        return {"url": url, "data": json_data}
    except Exception as exc:
        update_firecrawl_job(job_id, status="failed", error=str(exc))
        raise


def fc_crawl(topic_id, segment_id, url, limit=10, max_depth=2):
    config = json.dumps({"limit": limit, "max_depth": max_depth})
    job_id = create_firecrawl_job(topic_id, "crawl", url,
                                   segment_id=segment_id, config=config)
    try:
        fc = _get_firecrawl()
        result = fc.crawl(url, limit=limit,
                          max_discovery_depth=max_depth,
                          scrape_options={"formats": ["markdown"]})
        total = 0
        docs = getattr(result, "data", []) or []
        for doc in docs:
            meta = getattr(doc, "metadata", None)
            page_url = (getattr(meta, "source_url", "") or
                        getattr(meta, "url", "") or url) if meta else url
            page_title = getattr(meta, "title", "") if meta else ""
            md = getattr(doc, "markdown", "") or ""
            if md:
                add_research_source(
                    topic_id, page_url, page_title, md[:5000], "crawl")
                total += 1
        update_firecrawl_job(
            job_id, status="done", pages_found=total,
            result_preview=f"Crawled {total} pages")
        return {"total": total}
    except Exception as exc:
        update_firecrawl_job(job_id, status="failed", error=str(exc))
        raise


def fc_map(topic_id, url):
    job_id = create_firecrawl_job(topic_id, "map", url)
    try:
        fc = _get_firecrawl()
        result = fc.map(url, limit=200)
        raw_links = getattr(result, "links", []) or []
        urls = []
        for link in raw_links:
            if isinstance(link, str):
                urls.append(link)
            elif hasattr(link, "url"):
                urls.append(link.url)
            elif isinstance(link, dict):
                urls.append(link.get("url", ""))
        urls = [u for u in urls if u]
        update_firecrawl_job(
            job_id, status="done", pages_found=len(urls),
            result_preview=json.dumps(urls[:30], ensure_ascii=False))
        return {"links": urls, "total": len(urls)}
    except Exception as exc:
        update_firecrawl_job(job_id, status="failed", error=str(exc))
        raise


def fc_agent(topic_id, segment_id, prompt):
    job_id = create_firecrawl_job(topic_id, "agent", prompt,
                                   segment_id=segment_id)
    try:
        fc = _get_firecrawl()
        result = fc.agent(prompt=prompt)
        content = ""
        if hasattr(result, "data"):
            if isinstance(result.data, (dict, list)):
                content = json.dumps(result.data, ensure_ascii=False)
            else:
                content = str(result.data)
        if content:
            add_research_source(
                topic_id, f"agent://{prompt[:50]}",
                f"Agent: {prompt[:80]}", content[:5000], "agent")
        update_firecrawl_job(
            job_id, status="done",
            result_preview=content[:500] if content else "No data")
        return {"result": content[:2000]}
    except Exception as exc:
        update_firecrawl_job(job_id, status="failed", error=str(exc))
        raise


def fc_batch_scrape(topic_id, urls):
    job_id = create_firecrawl_job(topic_id, "batch_scrape",
                                   json.dumps(urls[:20]))
    try:
        fc = _get_firecrawl()
        result = fc.batch_scrape(urls[:20], formats=["markdown"])
        total = 0
        docs = getattr(result, "data", []) or []
        for doc in docs:
            meta = getattr(doc, "metadata", None)
            page_url = (getattr(meta, "source_url", "") or
                        getattr(meta, "url", "")) if meta else ""
            page_title = getattr(meta, "title", "") if meta else ""
            md = getattr(doc, "markdown", "") or ""
            if md and page_url:
                add_research_source(
                    topic_id, page_url, page_title, md[:5000], "scrape")
                total += 1
        update_firecrawl_job(
            job_id, status="done", pages_found=total,
            result_preview=f"Batch: {total} pages")
        return {"total": total}
    except Exception as exc:
        update_firecrawl_job(job_id, status="failed", error=str(exc))
        raise


def fc_status():
    try:
        fc = _get_firecrawl()
        credit_info = fc.get_credit_usage()
        concurrency = fc.get_concurrency()
        return {
            "connected": True,
            "credits": {
                "remaining": getattr(credit_info, "remaining", 0),
                "total": getattr(credit_info, "total", 0),
            },
            "concurrency": {
                "current": getattr(concurrency, "current", 0),
                "max": getattr(concurrency, "max", 0),
            },
        }
    except Exception:
        return {"connected": False, "credits": {}, "concurrency": {}}
