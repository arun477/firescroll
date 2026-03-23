import json
import os

from dotenv import load_dotenv

load_dotenv()


def generate_topic_json(topic_name, num_segments=6):
    from openai import OpenAI
    client = OpenAI()

    prompt = f"""Create a short-form educational video series about "{topic_name}".
Split it into {num_segments} standalone short videos (15-45 seconds each).

Return ONLY valid JSON with this exact structure:
{{
  "topic": "{topic_name}",
  "series_title": "<catchy series name>",
  "total_parts": {num_segments},
  "target_audience": "curious learners",
  "segments": [
    {{
      "id": 1,
      "title": "<short catchy title>",
      "hook": "<attention-grabbing opening line, 1-2 sentences>",
      "script": "<main educational content, 3-5 sentences, conversational tone>",
      "visual_cue": "<description of what should be shown on screen>",
      "duration": {{ "min_seconds": 15, "max_seconds": 45 }}
    }}
  ]
}}

Rules:
- Each segment should be self-contained but part of the series
- Hooks should be surprising facts or questions
- Scripts should be casual and engaging, not academic
- Visual cues should be vivid and specific
- Make it fun and shareable"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    data = json.loads(content)

    os.makedirs("data/topics", exist_ok=True)
    slug = topic_name.lower().replace(" ", "_")
    json_path = f"data/topics/{slug}.json"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Topic generated: {json_path}")
    return json_path
