<h1 align="center"><img src="assets/logo.svg" alt="" width="28" style="vertical-align: middle;" /> FireScroll</h1>
<p align="center">Brain rot, but educational. AI-powered short video creation from any topic.</p>

<br />

<p align="center">
  <img src="assets/hero.png" alt="FireScroll" width="800" />
</p>

<br />

## Overview

FireScroll is an end-to-end platform for creating short-form educational videos. Give it a topic and it handles the rest -- research, scriptwriting, scene composition, voice narration, and final render.

The core workflow:

- **Research** -- Crawl the web with [Firecrawl](https://firecrawl.dev), pull sources, build context.
- **Script** -- AI breaks the topic into segments, each with a hook, script, and visual direction.
- **Motion Director** -- Chat with an AI agent that writes and previews animated scenes in real-time using React/Remotion. You direct, it codes.
- **Render** -- One click to render with [ElevenLabs](https://elevenlabs.io) voice narration in 30+ languages.

## Quick Start

```bash
git clone https://github.com/arun477/firescroll.git
cd firescroll
docker compose up --build
```

Open [localhost:3500](http://localhost:3500) and add your API keys in **Settings**.

**Required keys:**

| Key | Purpose |
|-----|---------|
| OpenAI | Script generation, Motion Director agent |
| ElevenLabs | Voice narration, multilingual TTS |
| Firecrawl | Web research (optional) |

## How It Works

```
Topic  ->  Research  ->  Script  ->  Motion Director  ->  Render  ->  Video
```

Six services running in Docker:

| Service | Stack | What it does |
|---------|-------|--------------|
| frontend | React, Vite, nginx | UI on port 3500 |
| backend | FastAPI, SQLite | API, SSE streaming, job coordination on port 8500 |
| worker | Celery | Video generation pipeline |
| chat-worker | Celery | Motion Director AI agent (dedicated queue) |
| remotion-studio | Remotion, TypeScript | Scene rendering and live preview |
| redis | Redis | Broker, queue, conversation state |

The Motion Director is a conversational agent (OpenAI Agents SDK) that writes React.createElement code for each scene. Scenes render in an iframe preview and update live as you iterate. When ready, the backend orchestrates audio generation, scene rendering via Remotion, and final video assembly.

## Project Layout

```
server.py              API server and endpoints
chat_agent.py          Motion Director agent and tools
celery_app.py          Task queue config
db.py                  Database layer
remotion_pipeline.py   Render pipeline (TTS + video + merge)
voice.py               Voice provider abstraction
frontend/              React SPA
remotion-studio/       Remotion renderer and preview server
docker-compose.yml     All services
```

## Built With

- [Remotion](https://remotion.dev) -- Programmatic video rendering
- [ElevenLabs](https://elevenlabs.io) -- Voice synthesis
- [Firecrawl](https://firecrawl.dev) -- Web scraping and research
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) -- Motion Director agent

## License

All rights reserved.
