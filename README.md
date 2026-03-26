<h1 align="center"><img src="assets/logo.svg" alt="" width="28" style="vertical-align: middle;" /> FireScroll</h1>
<p align="center"><strong>Brain rot, but educational.</strong><br/>AI-powered short video creation platform.</p>

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
  <img src="assets/hero.png" alt="FireScroll" width="800" />
</p>

## Demo

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://www.youtube.com/watch?v=485MsI5a450">
        <img src="assets/firescroll-thumbnail.png" alt="FireScroll Overview" width="100%" />
      </a>
      <br />
      <strong>Overview</strong> — What FireScroll can do
    </td>
    <td align="center" width="50%">
      <a href="https://www.youtube.com/watch?v=vs4SbNTQTww">
        <img src="https://img.youtube.com/vi/vs4SbNTQTww/maxresdefault.jpg" alt="FireScroll Live Demo" width="100%" />
      </a>
      <br />
      <strong>Live Demo</strong> — Full walkthrough of the app
    </td>
  </tr>
</table>

> Raw demo videos are also available in the [`demo/`](demo/) directory.

## What It Does

Type any topic. FireScroll researches the web, writes scripts, composes animated scenes through a conversational AI director, and renders publish-ready vertical videos with voice narration in 30+ languages — the full pipeline from idea to final cut, running locally with Docker.

## Features

- **Research Engine** — Powered by [Firecrawl](https://firecrawl.dev) with six modes (search, scrape, crawl, extract, map, AI agent). Sources are synthesized into citation-backed scripts broken into segments with hooks, scripts, and visual cues.

- **Motion Director** — A chat-based AI agent that composes video scenes conversationally. It writes React/Remotion animation code in real-time with live preview. Five visual styles (cinematic, minimal, bold, editorial, playful), six scene templates, or fully custom programmatic control. *This is under active development — expect rough edges and breaking changes.*

- **Voice & Audio** — 50+ ultra-realistic voices via [ElevenLabs](https://elevenlabs.io) with adjustable stability, similarity, style, and speed. Multilingual TTS across 30+ languages with automatic translation. Built-in library of 20 AI-generated music tracks.

- **Video Rendering** — 1080×1920 vertical format at 30fps via [Remotion](https://remotion.dev). Three visual modes (AI backgrounds, fullscreen video, split-screen) and two caption styles (standard overlay, karaoke word-by-word sync). Output as MP4.

- **Media Library** — Upload your own background videos (MP4, MOV, AVI, WebM). Audio is stripped automatically.

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- API keys for **all three** services below (all required):

| Key | Purpose |
|-----|---------|
| [OpenAI](https://platform.openai.com/api-keys) | Script generation, image backgrounds, Motion Director agent |
| [ElevenLabs](https://elevenlabs.io) | Voice narration, multilingual TTS |
| [Firecrawl](https://firecrawl.dev) | Web research and source extraction |

### Run

```bash
git clone https://github.com/arun477/firescroll.git
cd firescroll
docker compose up --build
```

Open [localhost:3500](http://localhost:3500) and add your API keys in **Settings** before doing anything else.

### Usage

1. **Create a topic** — enter any subject from the dashboard.
2. **Research** — run Firecrawl jobs to gather source material, or write scripts directly.
3. **Studio** — review generated segments. Configure voice, visuals, music, and captions. One-click batch generation.
4. **Motion Director** — open the chat panel for any segment. Describe your creative vision, iterate conversationally, then render.

## Architecture

Six Docker services orchestrated via `docker-compose.yml`:

| Service | Stack | Port |
|---------|-------|------|
| **frontend** | React 19, Vite, nginx | 3500 |
| **backend** | FastAPI, SQLite | 8500 |
| **worker** | Celery | — |
| **chat-worker** | Celery (Motion Director queue) | — |
| **remotion-studio** | Remotion, TypeScript, Express | 3600 |
| **redis** | Redis 7 | 6379 |

## Roadmap

- [ ] Replace SQLite with PostgreSQL for production use
- [ ] Expand Motion Director with more scene templates and animation primitives
- [ ] Add export to social platforms (YouTube Shorts, TikTok, Reels)
- [ ] WebSocket-based real-time progress updates
- [ ] User authentication and multi-tenant support

## Built With

Built for the [Firecrawl](https://firecrawl.dev) x [ElevenLabs](https://elevenlabs.io) Hackathon.

- [Firecrawl](https://firecrawl.dev) — Turns any website into clean, LLM-ready data. The Search API powers FireScroll's research engine, giving AI agents real-time knowledge from the web in a single call.
- [ElevenLabs](https://elevenlabs.io) — Voice synthesis and multilingual TTS. 50+ ultra-realistic voices across 30+ languages for narration and audio generation.
- [Remotion](https://remotion.dev) — Programmatic video rendering in React.
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) — Conversational AI agent framework powering the Motion Director.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
