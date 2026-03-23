import json

from dotenv import load_dotenv

from db import (
    create_research_task,
    create_segment,
    get_segments_for_topic,
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


def generate_series_outline(topic_id, topic_title, num_segments=6):
    existing = get_segments_for_topic(topic_id)
    if existing:
        return {"segments": [{"num": s["segment_num"], "title": s["title"]} for s in existing]}

    task_id = create_research_task(topic_id, "outline", topic_title)
    try:
        update_research_task(task_id, status="running")
        client = _get_openai()

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": (
                f'Create a {num_segments}-part short-form video series outline about '
                f'"{topic_title}". Return JSON: {{"series_title": "...", "segments": '
                f'[{{"num": 1, "title": "catchy title", "angle": "unique angle/hook"}}]}}'
            )}],
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)

        update_topic(topic_id, series_title=data.get("series_title", topic_title),
                     total_segments=len(data["segments"]), research_status="outline_done")

        for seg in data["segments"]:
            create_segment(topic_id, seg["num"], title=seg["title"], source="ai")

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
                f'Write content for one short-form educational video segment.\n'
                f'Series: "{topic_title}"\n'
                f'Segment: "{segment_title}"\n\n'
                f'Return JSON: {{"hook": "1-2 sentence attention grabber", '
                f'"script": "3-5 sentence educational content, casual tone", '
                f'"visual_cue": "what should be shown on screen"}}'
            )}],
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)

        update_segment(segment_id, hook=data["hook"], script=data["script"],
                       visual_cue=data.get("visual_cue", ""), source="ai", status="ready")
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
        fc = _get_firecrawl()

        search_query = f"{topic_title} {segment_title} educational facts"
        results = fc.search(search_query, limit=5,
                            scrape_options={"formats": ["markdown"]})

        sources = []
        combined_content = ""

        if results and hasattr(results, "data"):
            for item in results.data:
                url = getattr(item, "url", "")
                title = getattr(item, "title", "")
                markdown = getattr(item, "markdown", "")
                sources.append({"url": url, "title": title})
                if markdown:
                    combined_content += (
                        f"\n\n--- Source: {title} ({url}) ---\n{markdown[:2000]}"
                    )

        update_research_task(task_id, status="processing")

        client = _get_openai()
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": (
                f'Using this researched information, write one short-form video segment.\n'
                f'Series: "{topic_title}"\n'
                f'Segment: "{segment_title}"\n\n'
                f'Research:\n{combined_content[:6000]}\n\n'
                f'Return JSON: {{"hook": "1-2 sentence attention grabber with a real fact", '
                f'"script": "3-5 sentence educational content using the research", '
                f'"visual_cue": "what should be shown on screen"}}'
            )}],
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)

        urls_json = json.dumps([s["url"] for s in sources], ensure_ascii=False)
        update_segment(segment_id, hook=data["hook"], script=data["script"],
                       visual_cue=data.get("visual_cue", ""), source="firecrawl",
                       source_urls=urls_json,
                       raw_research=combined_content[:5000], status="ready")
        update_research_task(task_id, status="done",
                             result=json.dumps(data, ensure_ascii=False))
        return data

    except Exception as exc:  # pylint: disable=broad-exception-caught
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
        generate_segment_content(topic_id, seg["id"], topic_title, seg["title"])

    _check_all_done(topic_id)


def research_all_firecrawl(topic_id, topic_title, num_segments=6):
    update_topic(topic_id, research_status="generating")
    generate_series_outline(topic_id, topic_title, num_segments)
    segments = get_segments_for_topic(topic_id)

    for seg in segments:
        if _is_segment_busy(seg):
            continue
        research_with_firecrawl(topic_id, seg["id"], topic_title, seg["title"])

    _check_all_done(topic_id)


def _check_all_done(topic_id):
    segments = get_segments_for_topic(topic_id)
    ready = sum(1 for s in segments if s["status"] == "ready")
    if ready == len(segments):
        update_topic(topic_id, research_status="done")
    else:
        update_topic(topic_id, research_status="partial")
