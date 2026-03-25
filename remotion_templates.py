"""Template registry and GPT prompt builder for Remotion scene generation."""

TEMPLATES = {
    "title_reveal": {
        "name": "Title Reveal",
        "description": "Animated title with glow effect, particles, gradient background. Use for opening/hook.",
        "props": {
            "title": "string (required) — main title text",
            "subtitle": "string (optional) — supporting text below title",
            "tagline": "string (optional) — small uppercase text above title",
            "colorScheme": "enum: warm|cool|neon|minimal (default: warm)",
        },
    },
    "fact_card": {
        "name": "Fact Card",
        "description": "Big animated number/stat with counting animation and label. Use for data points.",
        "props": {
            "number": "string (required) — the stat to display, e.g. '92M', '10x', '3.5B'",
            "label": "string (required) — description below the number",
            "accentColor": "string (optional) — hex color, default #E63250",
        },
    },
    "narrative": {
        "name": "Narrative",
        "description": "Word-by-word text reveal with cinematic styling. Use for script/explanation content.",
        "props": {
            "text": "string (required) — the narration text (keep under 50 words per scene)",
            "style": "enum: cinematic|minimal|bold (default: cinematic)",
            "highlightWords": "array of strings (optional) — words to highlight in accent color",
        },
    },
    "split_info": {
        "name": "Split Info",
        "description": "Heading with bullet points in glass cards. Use for lists, steps, or features.",
        "props": {
            "heading": "string (required) — section heading",
            "points": "array of strings (required) — 2-5 bullet points",
            "side": "enum: left|right (default: left)",
            "accentColor": "string (optional) — hex color, default #3b82f6",
        },
    },
    "cta_outro": {
        "name": "CTA / Outro",
        "description": "Call-to-action with animated ring and particles. Use for closing.",
        "props": {
            "headline": "string (required) — main CTA text",
            "subtext": "string (optional) — supporting text",
            "brandColor": "string (optional) — hex color, default #E63250",
        },
    },
}

STYLES = {
    "cinematic": "Dark, dramatic, warm reds and oranges. Bold typography. Particle effects.",
    "minimal": "Clean, muted, lots of whitespace. Subtle animations. Gray tones.",
    "bold": "High contrast, vibrant purples and cyans. Neon glow. Energetic.",
    "editorial": "Sophisticated, cool blues. Glass morphism. Professional feel.",
    "playful": "Bright colors, bouncy animations. Fun and approachable.",
}


def build_scene_gen_prompt(segment, user_prompt, style, audio_duration):
    """Build the GPT-4o system + user prompt for scene config generation."""

    template_docs = ""
    for tid, t in TEMPLATES.items():
        props_doc = "\n".join(f"      - {k}: {v}" for k, v in t["props"].items())
        template_docs += f'  "{tid}": {t["description"]}\n    Props:\n{props_doc}\n\n'

    total_frames = round(audio_duration * 30)
    style_desc = STYLES.get(style, STYLES["cinematic"])

    system = f"""You are a video scene composer for short-form educational content.
Given a segment (hook, script, visual_cue) and a creative prompt, generate a scene config JSON.

AVAILABLE TEMPLATES:
{template_docs}

RULES:
- fps is always 30, width 1080, height 1920 (vertical video)
- Total frames must equal exactly {total_frames} (for {audio_duration:.1f}s audio)
- Scenes must not overlap — each scene's "from" must be >= previous scene's from + durationInFrames
- Use 3-6 scenes. Start with title_reveal or fact_card, end with cta_outro
- Break long text across multiple narrative scenes (max 50 words each)
- Style direction: {style_desc}
- The hook maps to the opening scene, the script maps to middle scenes

Return ONLY valid JSON matching this schema:
{{
  "fps": 30,
  "width": 1080,
  "height": 1920,
  "scenes": [
    {{ "template": "<template_id>", "from": <int>, "durationInFrames": <int>, "props": {{ ... }} }}
  ]
}}"""

    user_msg = f"""Segment:
- Title: {segment.get("title", "")}
- Hook: {segment.get("hook", "")}
- Script: {segment.get("script", "")}
- Visual cue: {segment.get("visual_cue", "")}

Creative direction: {user_prompt or "Create an engaging educational video"}
Style: {style}
Audio duration: {audio_duration:.1f}s ({total_frames} frames at 30fps)

Generate the scene config JSON."""

    return system, user_msg
