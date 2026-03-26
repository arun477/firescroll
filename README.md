<h1 align="center"><img src="assets/logo.svg" alt="" width="28" style="vertical-align: middle;" /> FireScroll</h1>
<p align="center"><strong>Brain rot, but educational.</strong><br/>The scroll that actually teaches you something.</p>

<p align="center">
  <a href="https://www.youtube.com/playlist?list=PLvKK6yXEDiBB6dh2CBuf2Rdr3LdVNj3Hm">
    <img src="https://img.shields.io/badge/YouTube-Playlist-red?logo=youtube" alt="YouTube Playlist" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License" />
  </a>
</p>

<br />

<p align="center">
  <img src="assets/hero.png" alt="FireScroll" width="600" />
</p>

## Demo

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://www.youtube.com/watch?v=485MsI5a450">
        <img src="assets/firescroll-thumbnail.png" alt="FireScroll Overview" width="100%" />
      </a>
      <br />
      <a href="https://www.youtube.com/watch?v=485MsI5a450"><strong>Overview</strong> — What FireScroll can do</a>
    </td>
    <td align="center" width="50%">
      <a href="https://www.youtube.com/watch?v=vs4SbNTQTww">
        <img src="https://img.youtube.com/vi/vs4SbNTQTww/maxresdefault.jpg" alt="FireScroll Live Demo" width="100%" />
      </a>
      <br />
      <a href="https://www.youtube.com/watch?v=vs4SbNTQTww"><strong>Live Demo</strong> — Full walkthrough</a>
    </td>
  </tr>
</table>

> Raw demo videos are also available in the [`demo/`](demo/) directory.

## What It Does

Enter a topic. FireScroll researches the web using Firecrawl, generates scripts from real sources with citations, narrates them using ElevenLabs voices, renders vertical videos, and serves them in a scrollable feed. Full pipeline from topic to feed, runs locally with Docker.

## How It Works

```
Topic
  │
  ├──  Research         Firecrawl searches, scrapes, and extracts from the web
  │
  ├──  Script           GPT-4o synthesizes sources into segmented scripts with citations
  │
  ├──  Voice & Audio    ElevenLabs narrates in any language, AI music mixed in
  │
  ├──  Render           Remotion composes video with backgrounds, captions, transitions
  │
  ▼
Scrollable Feed
```

## Features

**Topic → Research → Generate → Scroll.**

### Research

Four research strategies:

| Mode | Process |
|------|---------|
| **Simple** | Search 5 results, extract markdown, synthesize into script |
| **Deep** | Search → GPT-4o ranks URLs → Scrape → Structured extraction → Synthesize |
| **Agent** | Firecrawl's AI agent researches the topic autonomously |
| **Manual** | Write or paste your own script |

Sources are stored with URL, title, and content. Citations link back to segments.

### Voice & Audio

50+ voices across 31 languages. Five presets:

| Preset | Stability | Speed | Style |
|--------|-----------|-------|-------|
| Natural | 0.5 | 1.0x | Neutral |
| Dramatic | 0.3 | 0.9x | High |
| Energetic | 0.4 | 1.15x | Medium |
| Calm | 0.8 | 0.9x | Subtle |
| Storyteller | 0.6 | 0.95x | Warm |

Each parameter is adjustable per segment. Non-English scripts are translated before narration. Background music is AI-generated or selected from a built-in library, mixed at 15% volume with fade-in/out.

### Video Rendering

Three visual modes:
- **Full** — 4 AI-generated backgrounds (DALL-E 3, 1024×1536) with Ken Burns zoom and crossfade transitions
- **Video** — uploaded video background with text overlay
- **Split** — video top half, AI background bottom half

Two caption styles:
- **Default** — text overlay with fade-in
- **Karaoke** — word-by-word highlighting synced via Whisper word-level timestamps

### Scrollable Feed

Videos appear in a vertical scroll feed with auto-play, progress tracking, and auto-advance. Infinite scroll loads more as you go.

### Media Library

Upload MP4, MOV, AVI, or WebM as backgrounds. Audio stripped on upload. Available across all projects.

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- **All three** API keys are required:

| Key | Purpose |
|-----|---------|
| [OpenAI](https://platform.openai.com/api-keys) | Script generation, image backgrounds, transcription |
| [ElevenLabs](https://elevenlabs.io) | Voice narration, multilingual TTS, music generation |
| [Firecrawl](https://firecrawl.dev) | Web research and source extraction |

### Run

```bash
git clone https://github.com/arun477/firescroll.git
cd firescroll
docker compose up --build
```

Open [localhost:3500](http://localhost:3500) and add your API keys in **Settings** first.

### Usage

1. **Create a topic** — enter any subject.
2. **Research** — pick a mode. Firecrawl scrapes the web, AI writes the scripts.
3. **Configure** — voice, visual mode, captions, music — all per segment.
4. **Generate** — batch generation with progress tracking across 7 phases.
5. **Scroll** — swipe through your feed.

## Supported Languages

English, Spanish, French, German, Portuguese, Italian, Dutch, Polish, Russian, Japanese, Korean, Chinese, Hindi, Arabic, Turkish, Swedish, Danish, Finnish, Indonesian, Thai, Vietnamese, Ukrainian, Czech, Romanian, Hungarian, Greek, Hebrew, Bengali, Tamil, Filipino.

Narration and script translation handled by ElevenLabs.

## Roadmap

### Infrastructure
- [ ] **PostgreSQL** — replace SQLite for concurrent writes and connection pooling. SQLite works for single-user but breaks under multi-tenant load.
- [ ] **Pre-built Docker images** — publish to Docker Hub. Skip the cold build, run with `docker compose pull && docker compose up`.
- [ ] **GPU-accelerated rendering** — Remotion is CPU-bound. GPU support would cut render times significantly.
- [ ] **Job queue visibility** — real-time dashboard for Celery workers with retry controls.

### Product
- [ ] **Social export** — publish directly to YouTube Shorts, TikTok, and Reels with platform-specific formatting and scheduling.
- [ ] **Shareable feeds** — public URLs so viewers can scroll without running the app. Embeddable player for external sites.
- [ ] **Scheduled generation** — set a topic and cadence. FireScroll researches and generates new content on autopilot.
- [ ] **Voice cloning** — consistent narrator from a 30-second sample via ElevenLabs across an entire series.
- [ ] **Interactive transcripts** — click any word to jump to that frame. Full-text search across all content.

### Scale
- [ ] **Multi-tenant auth** — user accounts, API key isolation, team workspaces.
- [ ] **PWA** — installable app with offline feed caching and push notifications for completed generations.
- [ ] **Analytics** — per-video watch time, completion rate, drop-off points, and engagement heatmaps.
- [ ] **Content graph** — link topics into learning paths. Auto-suggested via embeddings across generated content.

## Built With

Built for the [Firecrawl](https://firecrawl.dev) x [ElevenLabs](https://elevenlabs.io) Hackathon.

- [Firecrawl](https://firecrawl.dev) — Web research and data extraction. Search API provides real-time web knowledge in a single call. Six modes from search to structured extraction.
- [ElevenLabs](https://elevenlabs.io) — Voice synthesis and multilingual TTS. 50+ voices across 30+ languages with tunable style presets.
- [Remotion](https://remotion.dev) — Programmatic video rendering in React.
- [OpenAI](https://openai.com) — Script generation, image backgrounds, transcription.

## Contributing

Contributions welcome. Open an issue to discuss changes first.

## License

MIT — see [LICENSE](LICENSE).
