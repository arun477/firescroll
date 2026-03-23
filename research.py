import json
import traceback

from dotenv import load_dotenv

from db import (
    add_research_source,
    create_firecrawl_job,
    create_research_task,
    create_segment,
    get_research_sources,
    get_segments_for_topic,
    get_topic,
    update_firecrawl_job,
    update_research_task,
    update_segment,
    update_topic,
)
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


def _synthesize_segment(topic_id, segment_id, source="firecrawl"):
    from db import get_conn
    sources = get_research_sources(topic_id)
    print(f"[FC] Synthesize: {len(sources)} sources available")
    if not sources:
        print("[FC] No sources to synthesize from")
        return
    segments = get_segments_for_topic(topic_id)
    seg = next((s for s in segments if s["id"] == segment_id), None)
    if not seg:
        return

    context = ""
    conn = get_conn()
    for src in sources[:15]:
        title = src.get("title", "")
        url = src.get("url", "")
        row = conn.execute(
            "SELECT content FROM research_sources WHERE id = ?",
            (src["id"],)
        ).fetchone()
        content = (row["content"] if row else "")[:500]
        context += f"\n--- {title} ({url}) ---\n{content}\n"
        if len(context) > 6000:
            break
    conn.close()

    topic = get_topic(topic_id)
    update_segment(segment_id, status="researching")

    client = _get_openai()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": (
            f'Using this researched information, write one short-form video segment.\n'
            f'Series: "{topic["title"]}"\nSegment: "{seg["title"]}"\n\n'
            f'Research:\n{context}\n\n'
            f'Return JSON: {{"hook": "1-2 sentence attention grabber", '
            f'"script": "3-5 sentence educational content", '
            f'"visual_cue": "what should be shown on screen"}}'
        )}],
        response_format={"type": "json_object"},
    )
    data = json.loads(response.choices[0].message.content)
    source_urls = [s["url"] for s in sources[:10]]
    update_segment(segment_id, hook=data["hook"], script=data["script"],
                   visual_cue=data.get("visual_cue", ""), source=source,
                   source_urls=json.dumps(source_urls, ensure_ascii=False),
                   status="ready")


def generate_series_outline(topic_id, topic_title, num_segments=6):
    existing = get_segments_for_topic(topic_id)
    if existing:
        return {"segments": [{"num": s["segment_num"], "title": s["title"]}
                             for s in existing]}

    task_id = create_research_task(topic_id, "outline", topic_title)
    try:
        update_research_task(task_id, status="running")
        client = _get_openai()
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": (
                f'Create a {num_segments}-part short-form video series outline '
                f'about "{topic_title}". Return JSON: '
                f'{{"series_title": "...", "segments": '
                f'[{{"num": 1, "title": "catchy title"}}]}}'
            )}],
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)
        update_topic(topic_id,
                     series_title=data.get("series_title", topic_title),
                     total_segments=len(data["segments"]),
                     research_status="outline_done")
        for seg in data["segments"]:
            create_segment(topic_id, seg["num"], title=seg["title"])
        update_research_task(task_id, status="done",
                             result=json.dumps(data, ensure_ascii=False))
        return data
    except Exception as exc:  # pylint: disable=broad-exception-caught
        update_research_task(task_id, status="failed", error=str(exc))
        raise


def generate_segment_content(topic_id, segment_id, topic_title, segment_title):
    task_id = create_research_task(topic_id, "ai_generate", segment_title)
    try:
        update_segment(segment_id, status="researching")
        update_research_task(task_id, status="running")
        client = _get_openai()
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": (
                f'Write content for one short-form educational video.\n'
                f'Series: "{topic_title}"\nSegment: "{segment_title}"\n\n'
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
        update_research_task(task_id, status="done",
                             result=json.dumps(data, ensure_ascii=False))
        return data
    except Exception as exc:  # pylint: disable=broad-exception-caught
        update_segment(segment_id, status="failed")
        update_research_task(task_id, status="failed", error=str(exc))
        raise


def research_with_firecrawl(topic_id, segment_id, topic_title, segment_title):
    task_id = create_research_task(topic_id, "web_search",
                                   f"{topic_title}: {segment_title}")
    try:
        update_segment(segment_id, status="researching")
        update_research_task(task_id, status="searching")
        print(f"[FC] Searching: {topic_title} - {segment_title}")
        fc = _get_firecrawl()
        query = f"{topic_title} {segment_title} educational facts"
        results = fc.search(query, limit=5,
                            scrape_options={"formats": ["markdown"]})
        src_count = 0
        if results and hasattr(results, "data"):
            for item in results.data:
                url = getattr(item, "url", "")
                title = getattr(item, "title", "")
                markdown = getattr(item, "markdown", "")
                if markdown:
                    add_research_source(topic_id, url, title,
                                        markdown[:5000], "search")
                    src_count += 1
        print(f"[FC] Found {src_count} sources for: {segment_title}")

        update_research_task(task_id, status="processing")
        print(f"[FC] Synthesizing segment: {segment_title}")
        _synthesize_segment(topic_id, segment_id, "firecrawl")
        update_research_task(task_id, status="done")
        print(f"[FC] Done: {segment_title}")
    except Exception as exc:  # pylint: disable=broad-exception-caught
        print(f"[FC] ERROR: {segment_title}: {exc}")
        traceback.print_exc()
        update_segment(segment_id, status="failed")
        update_research_task(task_id, status="failed", error=str(exc))
        raise


def generate_all_ai(topic_id, topic_title, num_segments=6):
    update_topic(topic_id, research_status="generating")
    generate_series_outline(topic_id, topic_title, num_segments)
    segments = get_segments_for_topic(topic_id)
    for seg in segments:
        if _is_segment_busy(seg):
            continue
        try:
            generate_segment_content(topic_id, seg["id"], topic_title,
                                     seg["title"])
        except Exception:  # pylint: disable=broad-exception-caught
            pass
    _check_all_done(topic_id)


def research_all_firecrawl(topic_id, topic_title, num_segments=6):
    print(f"[FC] Starting research_all for: {topic_title}")
    update_topic(topic_id, research_status="generating")
    generate_series_outline(topic_id, topic_title, num_segments)
    segments = get_segments_for_topic(topic_id)
    print(f"[FC] Got {len(segments)} segments")
    for seg in segments:
        if _is_segment_busy(seg):
            print(f"[FC] Skipping busy: {seg['title']}")
            continue
        try:
            research_with_firecrawl(topic_id, seg["id"], topic_title,
                                     seg["title"])
        except Exception as exc:  # pylint: disable=broad-exception-caught
            print(f"[FC] Segment failed: {seg['title']}: {exc}")
    _check_all_done(topic_id)
    print(f"[FC] All done for: {topic_title}")


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
        new_count = 0
        total = 0
        if results and hasattr(results, "data"):
            for item in results.data:
                url = getattr(item, "url", "")
                title = getattr(item, "title", "")
                md = getattr(item, "markdown", "")
                if md:
                    was_new = add_research_source(
                        topic_id, url, title, md[:5000], "search")
                    if was_new:
                        new_count += 1
                    total += 1
        update_firecrawl_job(
            job_id, status="done", pages_found=total,
            result_preview=f"Found {total} results, {new_count} new")
        if segment_id:
            _synthesize_segment(topic_id, segment_id, "firecrawl")
        return {"total": total, "new": new_count}
    except Exception as exc:  # pylint: disable=broad-exception-caught
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
        was_new = add_research_source(topic_id, url, title, md[:5000],
                                       "scrape")
        preview = f"Scraped: {title[:80]}" if title else f"Scraped {url[:80]}"
        update_firecrawl_job(job_id, status="done", pages_found=1,
                             result_preview=preview)
        if segment_id:
            _synthesize_segment(topic_id, segment_id, "firecrawl")
        return {"url": url, "title": title, "new": was_new}
    except Exception as exc:  # pylint: disable=broad-exception-caught
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
        if segment_id:
            _synthesize_segment(topic_id, segment_id, "firecrawl")
        return {"url": url, "data": json_data}
    except Exception as exc:  # pylint: disable=broad-exception-caught
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
        new_count = 0
        total = 0
        if hasattr(result, "data"):
            for doc in result.data:
                meta = doc.metadata if hasattr(doc, "metadata") else None
                page_url = getattr(meta, "source_url", url) if meta else url
                page_title = getattr(meta, "title", "") if meta else ""
                md = getattr(doc, "markdown", "") or ""
                if md:
                    was_new = add_research_source(
                        topic_id, page_url, page_title, md[:5000], "crawl")
                    if was_new:
                        new_count += 1
                    total += 1
        update_firecrawl_job(
            job_id, status="done", pages_found=total,
            result_preview=f"Crawled {total} pages, {new_count} new")
        if segment_id:
            _synthesize_segment(topic_id, segment_id, "firecrawl")
        return {"total": total, "new": new_count}
    except Exception as exc:  # pylint: disable=broad-exception-caught
        update_firecrawl_job(job_id, status="failed", error=str(exc))
        raise


def fc_map(topic_id, url):
    job_id = create_firecrawl_job(topic_id, "map", url)
    try:
        fc = _get_firecrawl()
        result = fc.map(url, limit=200)
        links = getattr(result, "links", []) or []
        update_firecrawl_job(
            job_id, status="done", pages_found=len(links),
            result_preview=json.dumps(links[:30], ensure_ascii=False))
        return {"links": links, "total": len(links)}
    except Exception as exc:  # pylint: disable=broad-exception-caught
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
        if segment_id:
            _synthesize_segment(topic_id, segment_id, "firecrawl")
        return {"result": content[:2000]}
    except Exception as exc:  # pylint: disable=broad-exception-caught
        update_firecrawl_job(job_id, status="failed", error=str(exc))
        raise


def fc_batch_scrape(topic_id, urls):
    job_id = create_firecrawl_job(topic_id, "batch_scrape",
                                   json.dumps(urls[:20]))
    try:
        fc = _get_firecrawl()
        result = fc.batch_scrape(urls[:20], formats=["markdown"])
        new_count = 0
        total = 0
        if hasattr(result, "data"):
            for doc in result.data:
                meta = doc.metadata if hasattr(doc, "metadata") else None
                page_url = getattr(meta, "source_url", "") if meta else ""
                page_title = getattr(meta, "title", "") if meta else ""
                md = getattr(doc, "markdown", "") or ""
                if md and page_url:
                    was_new = add_research_source(
                        topic_id, page_url, page_title, md[:5000], "scrape")
                    if was_new:
                        new_count += 1
                    total += 1
        update_firecrawl_job(
            job_id, status="done", pages_found=total,
            result_preview=f"Batch: {total} pages, {new_count} new")
        return {"total": total, "new": new_count}
    except Exception as exc:  # pylint: disable=broad-exception-caught
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
    except Exception:  # pylint: disable=broad-exception-caught
        return {"connected": False, "credits": {}, "concurrency": {}}
