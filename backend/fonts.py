import os

from PIL import ImageFont

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "assets", "fonts")

# Latin fonts (English and Western European languages)
FONT_FILES = {
    "title": os.path.join(ASSETS_DIR, "Bangers.ttf"),
    "bold": os.path.join(ASSETS_DIR, "Poppins-ExtraBold.ttf"),
    "body": os.path.join(ASSETS_DIR, "Poppins-Bold.ttf"),
    "regular": os.path.join(ASSETS_DIR, "Montserrat.ttf"),
}

# Universal font covering all scripts (Tamil, Hindi, Arabic, CJK, etc.)
UNIVERSAL_FONT = os.path.join(ASSETS_DIR, "GoNotoKurrent-Bold.ttf")
UNIVERSAL_FONT_REGULAR = os.path.join(ASSETS_DIR, "GoNotoKurrent-Regular.ttf")

# Languages that need the universal font (non-Latin scripts)
LATIN_LANGUAGES = {"en", "es", "fr", "de", "pt", "it", "nl", "pl", "sv", "da",
                   "fi", "ro", "hu", "cs", "tr", "id", "vi", "fil"}

_cache = {}
_use_universal = False


def set_language(lang_code):
    """Call before rendering to switch to universal font for non-Latin scripts."""
    global _use_universal
    _use_universal = bool(lang_code and lang_code not in LATIN_LANGUAGES)


def get_font(style="body", size=40):
    key = (style, size, _use_universal)
    if key not in _cache:
        if _use_universal and os.path.exists(UNIVERSAL_FONT):
            # Use universal font for non-Latin scripts
            path = UNIVERSAL_FONT_REGULAR if style == "regular" else UNIVERSAL_FONT
            if not os.path.exists(path):
                path = UNIVERSAL_FONT
        else:
            path = FONT_FILES.get(style, FONT_FILES["body"])
        if not os.path.exists(path):
            raise FileNotFoundError(f"Font not found: {path}")
        _cache[key] = ImageFont.truetype(path, size)
    return _cache[key]
