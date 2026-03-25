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

# Style color palettes for generic scene expansion
STYLE_PALETTES = {
    "cinematic": {"bg": "#0a0a0f", "primary": "#E63250", "accent": "#ff6b35", "text": "#ffffff"},
    "minimal": {"bg": "#f5f5f5", "primary": "#333333", "accent": "#888888", "text": "#111111"},
    "bold": {"bg": "#0a000a", "primary": "#a855f7", "accent": "#22d3ee", "text": "#ffffff"},
    "editorial": {"bg": "#050a18", "primary": "#3b82f6", "accent": "#06b6d4", "text": "#ffffff"},
    "playful": {"bg": "#fef3c7", "primary": "#f59e0b", "accent": "#ec4899", "text": "#1f2937"},
}


def expand_template_to_generic(template_id, props, style="cinematic"):
    """Convert a template scene into a generic scene with direct visual properties."""
    p = STYLE_PALETTES.get(style, STYLE_PALETTES["cinematic"])

    if template_id == "title_reveal":
        return {
            "template": "generic",
            "props": {
                "backgroundColor": p["bg"],
                "backgroundGradient": f"radial-gradient(ellipse at 50% 30%, {p['primary']}15 0%, {p['bg']} 70%)",
                "textLayers": [
                    *([{"text": props.get("tagline", "").upper(), "fontSize": 24, "color": p["accent"],
                        "letterSpacing": "0.15em", "y": 700, "textAlign": "center",
                        "animation": "spring-in", "animationDelay": 0}] if props.get("tagline") else []),
                    {"text": props.get("title", "Title"), "fontSize": 76, "fontWeight": 800,
                     "color": p["text"], "glowColor": p["primary"],
                     "y": "center", "textAlign": "center", "animation": "spring-in", "animationDelay": 8},
                    *([{"text": props.get("subtitle", ""), "fontSize": 32, "color": f"{p['text']}b3",
                        "y": 1100, "textAlign": "center", "animation": "spring-in", "animationDelay": 20}]
                       if props.get("subtitle") else []),
                ],
                "particles": True, "particleColor": p["primary"],
                "dividerLine": True, "dividerColor": p["primary"],
            },
        }

    elif template_id == "fact_card":
        return {
            "template": "generic",
            "props": {
                "backgroundColor": p["bg"],
                "backgroundGradient": f"radial-gradient(ellipse at 50% 40%, {p['primary']}12 0%, {p['bg']} 70%)",
                "counter": {
                    "value": props.get("number", "0"),
                    "color": props.get("accentColor", p["primary"]),
                    "fontSize": 120, "delay": 10,
                },
                "glassCard": True, "glassCardAccentColor": props.get("accentColor", p["primary"]),
                "textLayers": [
                    {"text": props.get("label", ""), "fontSize": 36, "fontWeight": 600,
                     "color": f"{p['text']}cc", "y": 1100, "textAlign": "center",
                     "animation": "spring-in", "animationDelay": 20},
                ],
            },
        }

    elif template_id == "narrative":
        return {
            "template": "generic",
            "props": {
                "backgroundColor": p["bg"],
                "backgroundGradient": f"radial-gradient(ellipse at 50% 60%, {p['primary']}10 0%, {p['bg']} 70%)",
                "textLayers": [
                    {"text": props.get("text", ""), "fontSize": 40, "fontWeight": 600,
                     "color": p["text"], "y": "center", "textAlign": "center",
                     "animation": "word-by-word", "animationDelay": 0,
                     "highlightWords": props.get("highlightWords", [])},
                ],
                "particles": True, "particleColor": p["primary"], "particleCount": 15,
            },
        }

    elif template_id == "split_info":
        return {
            "template": "generic",
            "props": {
                "backgroundColor": p["bg"],
                "backgroundGradient": f"linear-gradient(160deg, {p['bg']} 0%, {p['accent']}08 50%, {p['bg']} 100%)",
                "textLayers": [
                    {"text": props.get("heading", ""), "fontSize": 48, "fontWeight": 800,
                     "color": p["text"], "y": 300, "textAlign": "left",
                     "animation": "spring-in", "animationDelay": 5},
                ],
                "points": props.get("points", []),
                "pointsAccentColor": props.get("accentColor", p["accent"]),
                "pointsSide": props.get("side", "left"),
            },
        }

    elif template_id == "cta_outro":
        return {
            "template": "generic",
            "props": {
                "backgroundColor": p["bg"],
                "backgroundGradient": f"radial-gradient(ellipse at 50% 50%, {p['primary']}20 0%, {p['bg']} 60%)",
                "textLayers": [
                    {"text": props.get("headline", ""), "fontSize": 64, "fontWeight": 800,
                     "color": p["text"], "glowColor": p["primary"],
                     "y": "center", "textAlign": "center", "animation": "spring-in", "animationDelay": 15},
                    *([{"text": props.get("subtext", ""), "fontSize": 28,
                        "color": f"{p['text']}99", "y": 1100, "textAlign": "center",
                        "animation": "spring-in", "animationDelay": 25}]
                       if props.get("subtext") else []),
                ],
                "ring": True, "ringColor": props.get("brandColor", p["primary"]),
                "particles": True, "particleColor": p["primary"], "particleCount": 40,
            },
        }

    return None


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
