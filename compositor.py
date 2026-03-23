from PIL import Image, ImageEnhance, ImageFilter

WIDTH = 1080
HEIGHT = 1920
TRANSITION_DUR = 1.0


def load_background(path):
    img = Image.open(path).convert("RGBA")
    img = img.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    img = ImageEnhance.Brightness(img).enhance(0.85)
    img = img.filter(ImageFilter.GaussianBlur(radius=1))
    return img


def crossfade(img_a, img_b, alpha):
    alpha = max(0.0, min(1.0, alpha))
    return Image.blend(img_a, img_b, alpha)


def _get_bg_at_time(bg_images, t, total_dur):
    if not bg_images:
        return Image.new("RGBA", (WIDTH, HEIGHT), (12, 12, 18, 255))
    if len(bg_images) == 1:
        return bg_images[0].copy()

    segment_dur = total_dur / len(bg_images)
    idx = min(int(t / segment_dur), len(bg_images) - 1)
    segment_t = t - (idx * segment_dur)
    transition_start = segment_dur - TRANSITION_DUR

    if segment_t < transition_start or idx >= len(bg_images) - 1:
        return bg_images[idx].copy()

    next_idx = idx + 1
    progress = (segment_t - transition_start) / TRANSITION_DUR
    return crossfade(bg_images[idx], bg_images[next_idx], progress)


def compose_frame(text_frame, bg_images, t, timing):
    total_dur = timing["total_duration"]

    bg = _get_bg_at_time(bg_images, t, total_dur)

    ken_burns = 1.0 + 0.03 * (t / total_dur)
    if ken_burns > 1.0:
        new_w = int(WIDTH * ken_burns)
        new_h = int(HEIGHT * ken_burns)
        bg = bg.resize((new_w, new_h), Image.Resampling.LANCZOS)
        left = (new_w - WIDTH) // 2
        top = (new_h - HEIGHT) // 2
        bg = bg.crop((left, top, left + WIDTH, top + HEIGHT))

    text_rgba = text_frame.convert("RGBA")
    bg.paste(text_rgba, (0, 0), text_rgba)
    return bg.convert("RGB")
