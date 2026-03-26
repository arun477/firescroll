<h1 align="center"><img src="assets/logo.svg" alt="" width="28" style="vertical-align: middle;" /> FireScroll</h1>
<p align="center"><strong>Brain rot, but educational.</strong><br/>Short-form video creation platform.</p>

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
      <a href="https://www.youtube.com/watch?v=vs4SbNTQTww"><strong>Live Demo</strong> — Full walkthrough of the app</a>
    </td>
  </tr>
</table>

> Raw demo videos are also available in the [`demo/`](demo/) directory.

## What It Does

Type any topic. FireScroll researches the web, writes scripts, generates voice narration, and renders vertical short-form videos you can scroll through — like a TikTok feed, but every video actually teaches you something. The entire pipeline from idea to scrollable feed, running locally with Docker.

## Features

- **Topic-to-Feed Pipeline** — Enter a topic, get a series of scroll-ready short videos. Each topic is broken into segments with hooks, scripts, and visual cues — structured for maximum retention.

- **Web Research** — Powered by [Firecrawl](https://firecrawl.dev) with six modes (search, scrape, crawl, extract, map, AI agent). Sources are synthesized into accurate, citation-backed scripts automatically.

- **Voice & Audio** — 50+ ultra-realistic voices via [ElevenLabs](https://elevenlabs.io) across 30+ languages with automatic translation. Five style presets (natural, dramatic, energetic, calm, storyteller) and a built-in library of AI-generated music tracks.

- **Scrollable Feed** — Generated videos appear in a vertical scroll feed. Swipe through topics like you would on TikTok or Reels — except everything is AI-researched and educational.

- **Video Studio** — Configure voice, visuals, music, and captions per segment. Three visual modes (AI-generated backgrounds, video backgrounds, split-screen), two caption styles (overlay, karaoke sync). One-click batch generation. Output as 1080×1920 MP4 at 30fps.

- **Media Library** — Upload your own background videos (MP4, MOV, AVI, WebM). Audio is stripped automatically. Shared across all projects.

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- API keys for **all three** services below (all required):

| Key | Purpose |
|-----|---------|
| [OpenAI](https://platform.openai.com/api-keys) | Script generation, image backgrounds |
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
2. **Research** — Firecrawl searches and scrapes the web, AI synthesizes sources into scripts.
3. **Generate** — configure voice, visuals, and music. Hit generate.
4. **Scroll** — watch your videos in the feed. Swipe through like TikTok.

## Roadmap

- [ ] Replace SQLite with PostgreSQL for production use
- [ ] Export to YouTube Shorts, TikTok, Reels
- [ ] User authentication and multi-tenant support

## Built With

Built for the [Firecrawl](https://firecrawl.dev) x [ElevenLabs](https://elevenlabs.io) Hackathon.

- [Firecrawl](https://firecrawl.dev) — Turns any website into clean, LLM-ready data. The Search API powers FireScroll's research engine, giving AI agents real-time knowledge from the web in a single call.
- [ElevenLabs](https://elevenlabs.io) — Voice synthesis and multilingual TTS. 50+ ultra-realistic voices across 30+ languages for narration and audio generation.
- [Remotion](https://remotion.dev) — Programmatic video rendering in React.
- [OpenAI](https://openai.com) — Script generation, image backgrounds, and AI orchestration.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
