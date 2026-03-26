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

Type any topic. FireScroll scrapes the web for real sources, writes scripts backed by citations, narrates them in ultra-realistic AI voices, and renders vertical short-form videos — then serves them in a scrollable feed you can swipe through like TikTok. Except everything you watch actually teaches you something.

The full pipeline from topic to scrollable feed. Runs locally with Docker.

## How It Works

```
Topic (e.g. "Quantum Computing")
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  1. Research (Firecrawl)                            │
│     Search the web → Scrape sources → Extract facts │
│     Up to 5 sources per segment, 8000 char context  │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  2. Script Generation (OpenAI GPT-4o)               │
│     Series outline → Hook + Script + Visual cues    │
│     Citation-backed, 6 segments per topic           │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  3. Voice & Audio (ElevenLabs)                      │
│     TTS narration → AI music → Mix at 15% volume    │
│     Auto-translate for non-English languages        │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  4. Video Rendering (Remotion)                      │
│     4 AI backgrounds per segment (DALL-E 3)         │
│     Ken Burns zoom + crossfade transitions          │
│     Word-level timestamps for karaoke captions      │
└──────────────────────┬──────────────────────────────┘
                       ▼
               Scrollable Feed
        1080×1920 MP4 · 30fps · Vertical
```

## Features

**Topic → Research → Generate → Scroll.**

### Firecrawl-Powered Research

Four research strategies depending on how deep you want to go:

| Mode | What it does |
|------|-------------|
| **Simple** | Search 5 web results, extract markdown, synthesize into script |
| **Deep** | Search → GPT-4o picks top URLs → Scrape → Structured extraction → Synthesize |
| **Agent** | Firecrawl's AI agent autonomously researches the topic end-to-end |
| **Manual** | Write or paste your own script directly |

Every source is stored with URL, title, and content. Citations are linked back to segments so you can trace where every fact came from.

### ElevenLabs Voice & Audio

50+ ultra-realistic voices across 31 languages with five tunable presets:

| Preset | Stability | Speed | Style |
|--------|-----------|-------|-------|
| Natural | 0.5 | 1.0x | Neutral |
| Dramatic | 0.3 | 0.9x | High |
| Energetic | 0.4 | 1.15x | Medium |
| Calm | 0.8 | 0.9x | Subtle |
| Storyteller | 0.6 | 0.95x | Warm |

Each setting (stability, similarity, style, speed) is individually adjustable per segment. Non-English scripts are automatically translated before narration.

Background music is either AI-generated via ElevenLabs or selected from a built-in track library. Music is normalized to 15% volume with 1.5s fade-in and 2s fade-out so it never competes with the voice.

### Video Rendering

Three visual modes and two caption styles — mix and match per segment:

**Visual Modes:**
- **Full** — 4 AI-generated backgrounds (DALL-E 3, 1024×1536) with Ken Burns zoom and 1-second crossfade transitions
- **Video** — fullscreen uploaded video background with text overlay
- **Split** — video top half, AI background bottom half

**Caption Styles:**
- **Default** — static text overlay with fade-in animation
- **Karaoke** — word-by-word highlighting synced to audio using Whisper word-level timestamps. Active words glow gold, spoken words fade to gray.

### Scrollable Feed

Generated videos land in a vertical scroll feed. Auto-play triggers when a video enters the viewport. Progress bar, mute toggle, replay, and fullscreen controls on every card. Videos auto-advance on completion. Infinite scroll loads the next batch as you approach the bottom.

This is the core experience — scroll through AI-generated educational content the same way you'd scroll TikTok.

### Media Library

Upload your own MP4, MOV, AVI, or WebM files as background videos. Audio is stripped automatically on upload. Files are shared across all projects and available as backgrounds in Video and Split rendering modes.

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- **All three** API keys below are required:

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

1. **Create a topic** — enter any subject from the dashboard.
2. **Research** — pick a research mode. Firecrawl scrapes the web, AI synthesizes sources into scripts.
3. **Configure** — choose voice, visual mode, caption style, and music per segment.
4. **Generate** — one-click batch generation. Progress tracked across 7 phases.
5. **Scroll** — swipe through your feed.

## Supported Languages

English, Spanish, French, German, Portuguese, Italian, Dutch, Polish, Russian, Japanese, Korean, Chinese, Hindi, Arabic, Turkish, Swedish, Danish, Finnish, Indonesian, Thai, Vietnamese, Ukrainian, Czech, Romanian, Hungarian, Greek, Hebrew, Bengali, Tamil, Filipino.

Voice narration and automatic script translation handled end-to-end by ElevenLabs.

## Roadmap

### Infrastructure
- [ ] **PostgreSQL migration** — replace SQLite for concurrent writes, connection pooling, and production-grade durability. SQLite works for single-user local but breaks under multi-tenant load.
- [ ] **Pre-built Docker images** — publish to Docker Hub so users skip the 5+ minute cold build. One `docker compose pull && docker compose up` to run.
- [ ] **GPU-accelerated rendering** — Remotion rendering is CPU-bound today. NVIDIA GPU support would cut render times from minutes to seconds per segment.
- [ ] **Job queue dashboard** — real-time visibility into Celery workers. See queued, active, and failed jobs with retry controls instead of polling the database.

### Product
- [ ] **Social export** — one-click publish to YouTube Shorts, TikTok, and Reels. Auto-crop, platform-specific aspect ratios, metadata injection, and scheduling.
- [ ] **Shareable feed links** — public URLs for generated feeds. Viewers scroll your content without running the app. Embeddable player for blogs and docs.
- [ ] **Scheduled generation** — set a topic and cadence (daily, weekly). FireScroll autonomously researches trending angles, generates new segments, and drops them into your feed.
- [ ] **Multi-source voice cloning** — clone a consistent narrator voice from a 30-second sample via ElevenLabs. Every video in a series sounds like the same person.
- [ ] **Interactive transcripts** — click any word in the transcript to jump to that frame. Full-text search across all generated content.

### Scale
- [ ] **Multi-tenant auth** — user accounts, API key isolation, team workspaces, and role-based access. Required before any hosted deployment.
- [ ] **Mobile-first PWA** — installable app with offline feed caching, push notifications for completed generations, and native swipe gestures.
- [ ] **Analytics engine** — per-video watch time, completion rate, drop-off points, and segment-level engagement heatmaps. Data-driven iteration on what hooks work.
- [ ] **Content graph** — link related topics into learning paths. "Finished Quantum Computing? Here's Particle Physics." Auto-suggested by embeddings across your generated library.

## Built With

Built for the [Firecrawl](https://firecrawl.dev) x [ElevenLabs](https://elevenlabs.io) Hackathon.

- [Firecrawl](https://firecrawl.dev) — The research backbone. Search API gives AI agents real-time knowledge from any website in a single call. Six modes power the entire content pipeline — from web search to structured extraction.
- [ElevenLabs](https://elevenlabs.io) — The voice layer. 50+ voices across 30+ languages turn every script into broadcast-quality narration. Style presets and speed controls make each video sound intentional, not robotic.
- [Remotion](https://remotion.dev) — Programmatic video rendering in React.
- [OpenAI](https://openai.com) — Script generation, image backgrounds, transcription, and AI orchestration.

## Contributing

Contributions are welcome. Open an issue first to discuss what you'd like to change. Pull requests for bug fixes are always appreciated.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
