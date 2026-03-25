from PIL import Image, ImageDraw

from fonts import get_font

WIDTH = 1080
HEIGHT = 1920
FPS = 30
FADE_DUR = 0.3

TITLE_COLOR = (255, 255, 255)
TITLE_BG = (230, 50, 80, 230)
BADGE_BG = (50, 50, 50, 200)
HOOK_BG = (20, 120, 255, 210)
SCRIPT_BG = (30, 30, 30, 200)
CAPTION_TEXT = (255, 255, 255)
TEXT_PAD_X = 36
TEXT_PAD_Y = 18
PILL_RADIUS = 24


def center_x(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return (WIDTH - (bbox[2] - bbox[0])) // 2


def text_size(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def wrap_lines(draw, text, font, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            # If a single word exceeds max_width, force-break it
            word_w = draw.textbbox((0, 0), word, font=font)
            if word_w[2] - word_w[0] > max_width:
                # Character-level break for oversized words
                chunk = ""
                for ch in word:
                    test_ch = chunk + ch
                    ch_w = draw.textbbox((0, 0), test_ch, font=font)
                    if ch_w[2] - ch_w[0] > max_width and chunk:
                        lines.append(chunk)
                        chunk = ch
                    else:
                        chunk = test_ch
                current = chunk
            else:
                current = word
    if current:
        lines.append(current)
    return lines


def ease_out_back(t):
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2)


def ease_out_cubic(t):
    return 1 - pow(1 - t, 3)


def draw_pill(draw, x, y, w, h, *, fill, radius=PILL_RADIUS):
    draw.rounded_rectangle([(x, y), (x + w, y + h)], radius=radius, fill=fill)


def draw_bold_text(draw, text, pos, font, *, fill=CAPTION_TEXT, stroke=5):
    # Match stroke alpha to text alpha so fade-ins don't show a dark halo
    stroke_alpha = fill[3] if len(fill) == 4 else 255
    draw.text(pos, text, font=font, fill=fill,
              stroke_width=stroke, stroke_fill=(0, 0, 0, stroke_alpha))


def _draw_series_badge(img, segment, t):
    font = get_font("body", 30)
    series = segment.get("series_title", "")
    if not series:
        return
    draw = ImageDraw.Draw(img)
    alpha = min(1.0, t / FADE_DUR)
    a = int(255 * alpha)
    badge_pad_x = 24
    badge_pad_y = 12
    max_badge_w = WIDTH - badge_pad_x * 2 - 60
    tw, th = text_size(draw, series, font)
    # Truncate with ellipsis if badge text is too wide
    if tw > max_badge_w:
        while tw > max_badge_w and len(series) > 1:
            series = series[:-1]
            tw, th = text_size(draw, series.rstrip() + "…", font)
        series = series.rstrip() + "…"
        tw, th = text_size(draw, series, font)
    sx = (WIDTH - tw) // 2
    y = 60
    badge_bg = (*BADGE_BG[:3], int(BADGE_BG[3] * alpha))
    draw_pill(draw, sx - badge_pad_x, y - badge_pad_y,
              tw + badge_pad_x * 2, th + badge_pad_y * 2,
              fill=badge_bg, radius=25)
    draw_bold_text(draw, series, (sx, y), font,
                   fill=(255, 255, 255, a), stroke=2)


def _draw_title(img, segment, t):
    font = get_font("title", 72)
    title = segment["title"].upper()
    draw = ImageDraw.Draw(img)

    max_text_w = WIDTH - TEXT_PAD_X * 2 - 80
    lines = wrap_lines(draw, title, font, max_text_w)

    line_gap = 12
    y_base = 130

    if t < 0.4:
        progress = ease_out_back(min(1.0, t / 0.4))
        y_offset = int((1 - progress) * 80)
        alpha = min(1.0, t / 0.2)
        a = int(255 * alpha)
        bg_a = int(TITLE_BG[3] * alpha)
    else:
        y_offset = 0
        alpha = 1.0
        a = 255
        bg_a = TITLE_BG[3]

    y_cursor = y_base + y_offset
    for line in lines:
        tw, th = text_size(draw, line, font)
        lx = (WIDTH - tw) // 2
        draw_pill(draw, lx - TEXT_PAD_X, y_cursor - TEXT_PAD_Y,
                  tw + TEXT_PAD_X * 2, th + TEXT_PAD_Y * 2,
                  fill=(*TITLE_BG[:3], bg_a))
        draw_bold_text(draw, line, (lx, y_cursor), font,
                       fill=(*TITLE_COLOR, a), stroke=4)
        y_cursor += th + TEXT_PAD_Y * 2 + line_gap


def _draw_caption_block(img, lines, t_offset, duration, font, *,
                        y_center, pill_fill, max_visible=2):
    draw = ImageDraw.Draw(img)
    if not lines:
        return
    time_per_line = duration / len(lines)
    current_idx = min(int(t_offset / time_per_line), len(lines) - 1)

    visible_start = max(0, current_idx - max_visible + 1)
    visible_end = min(len(lines), current_idx + 1)
    visible = list(range(visible_start, visible_end))

    line_h = 85
    block_h = len(visible) * line_h
    y_start = y_center - (block_h // 2)

    for vi, idx in enumerate(visible):
        line = lines[idx]
        line_start = idx * time_per_line
        line_age = t_offset - line_start

        if idx == current_idx:
            pop = min(1.0, line_age / 0.15)
            alpha = ease_out_cubic(pop)
            scale = min(1.0, 0.9 + 0.1 * ease_out_back(min(1.0, line_age / 0.3)))
            y_slide = int((1 - ease_out_cubic(min(1.0, line_age / 0.15))) * 30)
        else:
            alpha = 0.6
            scale = 1.0
            y_slide = 0

        a = int(255 * alpha)
        y_pos = y_start + (vi * line_h) + y_slide

        font_size = int(font.size * scale)
        scaled_font = get_font("bold", font_size)
        tw, th = text_size(draw, line, scaled_font)
        lx = (WIDTH - tw) // 2

        pill_a = int(pill_fill[3] * alpha)
        draw_pill(draw, lx - TEXT_PAD_X, y_pos - TEXT_PAD_Y,
                  tw + TEXT_PAD_X * 2, th + TEXT_PAD_Y * 2,
                  fill=(*pill_fill[:3], pill_a))
        draw_bold_text(draw, line, (lx, y_pos), scaled_font,
                       fill=(255, 255, 255, a), stroke=5)


def _draw_hook_lines(img, segment, t, hook_end):
    if t >= hook_end:
        return
    font = get_font("bold", 50)
    draw = ImageDraw.Draw(img)
    lines = wrap_lines(draw, segment["hook"], font, WIDTH - 180)
    _draw_caption_block(img, lines, t, hook_end, font,
                        y_center=HEIGHT * 2 // 3, pill_fill=HOOK_BG)


def _draw_script_lines(img, segment, t, hook_end, total_dur):
    if t < hook_end:
        return
    font = get_font("bold", 44)
    draw = ImageDraw.Draw(img)
    lines = wrap_lines(draw, segment["script"], font, WIDTH - 160)
    st = t - hook_end
    script_dur = total_dur - hook_end
    _draw_caption_block(img, lines, st, script_dur, font,
                        y_center=HEIGHT * 2 // 3, pill_fill=SCRIPT_BG)


def _draw_progress_bar(draw, progress):
    bar_h = 8
    y = HEIGHT - bar_h
    draw.rectangle([(0, y), (WIDTH, HEIGHT)], fill=(50, 50, 50, 120))
    bar_w = int(WIDTH * progress)
    draw.rectangle([(0, y), (bar_w, HEIGHT)], fill=(230, 50, 80, 240))


def render_frame(segment, frame_num, total_frames, timing):
    img = Image.new("RGBA", (WIDTH, HEIGHT), color=(0, 0, 0, 0))
    t = frame_num / FPS
    hook_end = timing["hook_duration"]
    total_dur = timing["total_duration"]

    _draw_series_badge(img, segment, t)
    _draw_title(img, segment, t)
    _draw_hook_lines(img, segment, t, hook_end)
    _draw_script_lines(img, segment, t, hook_end, total_dur)

    draw = ImageDraw.Draw(img)
    _draw_progress_bar(draw, frame_num / total_frames)

    return img


def render_thumbnail(segment):
    img = Image.new("RGBA", (WIDTH, HEIGHT), color=(0, 0, 0, 0))

    _draw_series_badge(img, segment, 1.0)

    font_title = get_font("title", 80)
    draw = ImageDraw.Draw(img)
    title = segment["title"].upper()
    max_text_w = WIDTH - TEXT_PAD_X * 2 - 80
    title_lines = wrap_lines(draw, title, font_title, max_text_w)
    line_gap = 12
    y_cursor = 140
    for line in title_lines:
        tw, th = text_size(draw, line, font_title)
        lx = (WIDTH - tw) // 2
        draw_pill(draw, lx - TEXT_PAD_X, y_cursor - TEXT_PAD_Y,
                  tw + TEXT_PAD_X * 2, th + TEXT_PAD_Y * 2, fill=TITLE_BG)
        draw_bold_text(draw, line, (lx, y_cursor), font_title,
                       fill=TITLE_COLOR, stroke=5)
        y_cursor += th + TEXT_PAD_Y * 2 + line_gap

    font_hook = get_font("bold", 52)
    lines = wrap_lines(draw, segment["hook"], font_hook, WIDTH - 180)
    line_h = 85
    total_h = len(lines) * line_h
    y_start = (HEIGHT * 2 // 3) - (total_h // 2)
    for i, line in enumerate(lines):
        tw, th = text_size(draw, line, font_hook)
        lx = (WIDTH - tw) // 2
        y_pos = y_start + i * line_h
        draw_pill(draw, lx - TEXT_PAD_X, y_pos - TEXT_PAD_Y,
                  tw + TEXT_PAD_X * 2, th + TEXT_PAD_Y * 2, fill=HOOK_BG)
        draw_bold_text(draw, line, (lx, y_pos), font_hook, stroke=5)

    return img
