<h1 align="center"><img src="assets/logo.svg" alt="" width="28" style="vertical-align: middle;" /> FireScroll</h1>
<p align="center">Brain rot, but educational.<br/>AI-powered short video creation platform.</p>

<br />

<p align="center">
  <img src="assets/hero.png" alt="FireScroll" width="800" />
</p>

<br />

Type any topic. FireScroll researches the web, writes scripts, composes animated scenes through a conversational AI director, and renders publish-ready vertical videos with voice narration in 30+ languages. The full pipeline from idea to final cut, running locally with Docker.

## Quick Start

```bash
git clone https://github.com/arun477/firescroll.git
cd firescroll
docker compose up --build
```

Open [localhost:3500](http://localhost:3500) and configure your API keys in **Settings**.

| Key | Purpose | Required |
|-----|---------|----------|
| OpenAI | Script generation, Motion Director agent | Yes |
| ElevenLabs | Voice narration, multilingual TTS | Yes |
| Firecrawl | Web research and source crawling | Optional |

## Features

### Research Engine
Powered by [Firecrawl](https://firecrawl.dev) with six research modes -- search, scrape, crawl, extract, map, and AI agent. Sources are synthesized into accurate, citation-backed scripts. Each topic gets broken into segments with hooks, scripts, visual cues, and series structure.

### Motion Director
An AI agent you chat with to compose video scenes. It writes React/Remotion animation code in real-time -- title reveals, stat counters, word-by-word text, bullet points, CTAs. The preview updates live as you iterate. Five visual styles to choose from: cinematic, minimal, bold, editorial, and playful. Six scene templates as starting points, or go fully custom with programmatic control.

### Voice and Audio
50+ ultra-realistic voices via [ElevenLabs](https://elevenlabs.io) with adjustable stability, similarity, style, and speed. Multilingual TTS across 30+ languages. Built-in library of 20 AI-generated music tracks spanning ambient, cinematic, and lo-fi genres.

### Video Output
1080x1920 vertical format at 30fps, rendered through [Remotion](https://remotion.dev). Three visual modes -- full AI-generated backgrounds, fullscreen video backgrounds, or split-screen. Two caption styles: standard overlay or karaoke-style word-by-word sync. Output as MP4.

### Media Library
Upload your own background videos (MP4, MOV, AVI, WebM). Audio is stripped automatically. Shared across all projects.

## Usage

1. **Create a topic** from the dashboard -- enter any subject.
2. **Research** -- run Firecrawl jobs to gather source material, or write directly.
3. **Studio** -- review generated segments. Configure voice, visuals, music, and captions per segment. One-click batch generation.
4. **Motion Director** -- open the chat panel for any segment. Describe your vision or say "compose scenes." The AI agent creates animated scenes, you iterate conversationally, then render.

## Architecture

Six Docker services:

| Service | Stack | Role |
|---------|-------|------|
| **frontend** | React, Vite, nginx | SPA on port 3500 |
| **backend** | FastAPI, SQLite | API, SSE streaming, job management on port 8500 |
| **worker** | Celery | Video generation and rendering pipeline |
| **chat-worker** | Celery | Dedicated queue for the Motion Director agent |
| **remotion-studio** | Remotion, TypeScript | Scene rendering engine and live preview server |
| **redis** | Redis 7 | Message broker, task queue, conversation state |

```
User -> Frontend -> Backend API -> Celery Workers -> Remotion Studio
                                -> Redis (state + queue)
                                -> SQLite (persistence)
```

## Built With

[Remotion](https://remotion.dev) -- Programmatic video rendering in React
| [ElevenLabs](https://elevenlabs.io) -- Voice synthesis and multilingual TTS
| [Firecrawl](https://firecrawl.dev) -- Web research and data extraction
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) -- Conversational AI agent framework

## License

All rights reserved.
