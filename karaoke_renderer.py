from PIL import Image, ImageDraw

from fonts import get_font
from text_renderer import (
    WIDTH,
    HEIGHT,
    FPS,
    TEXT_PAD_X,
    TEXT_PAD_Y,
    _draw_progress_bar,
    _draw_series_badge,
    _draw_title,
    draw_pill,
    ease_out_cubic,
    text_size,
)

HIGHLIGHT_COLOR = (255, 230, 0)
SPOKEN_COLOR = (200, 200, 200)
UNSPOKEN_COLOR = (255, 255, 255)
WORD_BG = (20, 20, 30, 200)
ACTIVE_WORD_BG = (230, 50, 80, 230)
STROKE_W = 4
# Safe margin: padding + stroke + extra breathing room
MAX_LINE_WIDTH = WIDTH - (TEXT_PAD_X + STROKE_W + 20) * 2
LINE_H = 90


def _word_by_word_width(words_text, font, draw):
    """Measure width the same way rendering works: sum of individual words + spaces."""
    space_w, _ = text_size(draw, " ", font)
    total = 0
    for i, word in enumerate(words_text):
        ww, _ = text_size(draw, word, font)
        total += ww
        if i < len(words_text) - 1:
            total += space_w
    # Account for stroke extending beyond measured text
    total += STROKE_W * 2
    return total


def _group_words_into_lines(words, font, draw):
    """Group words into lines based on pixel width, matching word-by-word rendering."""
    lines = []
    current_words = []
    current_word_texts = []
    for w in words:
        test_texts = current_word_texts + [w["word"]]
        tw = _word_by_word_width(test_texts, font, draw)
        if tw > MAX_LINE_WIDTH and current_words:
            lines.append({
                "words": current_words,
                "start": current_words[0]["start"],
                "end": current_words[-1]["end"],
                "text": " ".join(current_word_texts),
            })
            current_words = [w]
            current_word_texts = [w["word"]]
        else:
            current_words.append(w)
            current_word_texts.append(w["word"])
    if current_words:
        lines.append({
            "words": current_words,
            "start": current_words[0]["start"],
            "end": current_words[-1]["end"],
            "text": " ".join(current_word_texts),
        })
    return lines


def _draw_karaoke_captions(img, word_timestamps, t):
    if not word_timestamps:
        return

    draw = ImageDraw.Draw(img)
    font = get_font("bold", 50)
    small_font = get_font("bold", 42)

    lines = _group_words_into_lines(word_timestamps, font, draw)

    current_line_idx = 0
    for i, line in enumerate(lines):
        if line["start"] <= t <= line["end"]:
            current_line_idx = i
            break
        if t > line["end"]:
            current_line_idx = i

    visible_start = max(0, current_line_idx - 1)
    visible_end = min(len(lines), current_line_idx + 2)
    visible_lines = list(range(visible_start, visible_end))

    block_h = len(visible_lines) * LINE_H
    y_start = (HEIGHT * 2 // 3) - (block_h // 2)

    for vi, line_idx in enumerate(visible_lines):
        line = lines[line_idx]
        is_current = line_idx == current_line_idx
        use_font = font if is_current else small_font

        word_texts = [wi["word"] for wi in line["words"]]
        rendered_w = _word_by_word_width(word_texts, use_font, draw)
        _, th = text_size(draw, line["text"], use_font)
        lx = max(STROKE_W, (WIDTH - rendered_w) // 2)
        y_pos = y_start + vi * LINE_H

        if line["start"] > t:
            entry_t = 0.0
        else:
            entry_t = min(1.0, (t - line["start"]) / 0.2)

        alpha = ease_out_cubic(entry_t)
        y_slide = int((1 - ease_out_cubic(entry_t)) * 25) if is_current else 0

        if not is_current:
            alpha *= 0.5

        a = int(255 * alpha)
        pill_bg = ACTIVE_WORD_BG if is_current else WORD_BG
        pill_a = int(pill_bg[3] * alpha)

        draw_pill(draw, lx - TEXT_PAD_X, y_pos + y_slide - TEXT_PAD_Y,
                  rendered_w + TEXT_PAD_X * 2, th + TEXT_PAD_Y * 2,
                  fill=(*pill_bg[:3], pill_a))

        space_w, _ = text_size(draw, " ", use_font)
        cursor_x = lx
        stroke_w = STROKE_W if is_current else 3
        for word_info in line["words"]:
            word = word_info["word"]
            ww, _ = text_size(draw, word, use_font)

            if t >= word_info["end"]:
                color = (*SPOKEN_COLOR, a)
            elif t >= word_info["start"]:
                color = (*HIGHLIGHT_COLOR, a)
            else:
                color = (*UNSPOKEN_COLOR, a)

            draw.text((cursor_x, y_pos + y_slide), word, font=use_font, fill=color,
                      stroke_width=stroke_w,
                      stroke_fill=(0, 0, 0, a))
            cursor_x += ww + space_w


def render_karaoke_frame(segment, frame_num, total_frames, _timing, word_timestamps):
    img = Image.new("RGBA", (WIDTH, HEIGHT), color=(0, 0, 0, 0))
    t = frame_num / FPS

    _draw_series_badge(img, segment, t)
    _draw_title(img, segment, t)
    _draw_karaoke_captions(img, word_timestamps, t)

    draw = ImageDraw.Draw(img)
    _draw_progress_bar(draw, frame_num / total_frames)

    return img
