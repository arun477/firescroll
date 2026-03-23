import os

from PIL import ImageFont

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "assets", "fonts")

FONT_FILES = {
    "title": os.path.join(ASSETS_DIR, "Bangers.ttf"),
    "bold": os.path.join(ASSETS_DIR, "Poppins-ExtraBold.ttf"),
    "body": os.path.join(ASSETS_DIR, "Poppins-Bold.ttf"),
    "regular": os.path.join(ASSETS_DIR, "Montserrat.ttf"),
}

_cache = {}


def get_font(style="body", size=40):
    key = (style, size)
    if key not in _cache:
        path = FONT_FILES.get(style, FONT_FILES["body"])
        if not os.path.exists(path):
            raise FileNotFoundError(f"Font not found: {path}")
        _cache[key] = ImageFont.truetype(path, size)
    return _cache[key]
