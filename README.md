<h1 align="center"><img src="assets/logo.svg" alt="" width="28" style="vertical-align: middle;" /> FireScroll</h1>
<p align="center">Short video creation platform. Type any topic. AI researches, writes, and renders addictive short-form videos with ultra-realistic voices and custom music.</p>

<p align="center">
  <img src="assets/hero.png" alt="FireScroll" width="800" />
</p>

---

## What It Does

FireScroll takes a topic and turns it into publish-ready short-form video content. The pipeline is fully automated:

1. **Research** -- Crawls the web using Firecrawl, extracts sources, and builds a knowledge base for the topic.
2. **Write** -- AI generates segmented scripts with hooks, visual cues, and series structure.
3. **Motion Director** -- A conversational AI agent composes animated scenes by writing React/Remotion code in real-time. You direct, it builds.
4. **Render** -- Remotion renders the final video with ElevenLabs voice narration, translated to 30+ languages.

## Architecture

```
Frontend (React)  -->  Backend (FastAPI)  -->  Workers (Celery + Redis)
                                           -->  Remotion Studio (Node/TypeScript)
```

| Service | Role |
|---------|------|
| **frontend** | React SPA served via nginx (port 3500) |
| **backend** | FastAPI server handling API, SSE streaming, job management (port 8500) |
| **worker** | Celery worker for video generation tasks |
| **chat-worker** | Dedicated Celery worker for the Motion Director AI agent |
| **remotion-studio** | Remotion rendering API and live preview server |
| **redis** | Message broker, task queue, and conversation state |

## Requirements

- Docker and Docker Compose
- API keys (configured through the Settings page after first launch):
  - **OpenAI** -- powers the Motion Director agent and script generation
  - **ElevenLabs** -- voice synthesis and multilingual narration
  - **Firecrawl** (optional) -- web research and source crawling

## Getting Started

```bash
git clone <repo-url> && cd firescroll
docker compose up --build
```

Open `http://localhost:3500`. Go to **Settings** and add your API keys.

## Usage

1. **Create a topic** from the dashboard.
2. **Research** -- run web crawls to gather source material, or skip to write directly.
3. **Studio** -- review and edit generated segments (scripts, hooks, visual direction).
4. **Motion Director** -- open the chat panel, describe your vision or say "compose scenes." The AI writes animated scene code, preview updates live. Iterate conversationally, then hit Render.

## Project Structure

```
server.py              FastAPI application
chat_agent.py          Motion Director AI agent (OpenAI Agents SDK)
celery_app.py          Task queue definitions
db.py                  SQLite database layer
remotion_pipeline.py   Render orchestration (audio + video merge)
frontend/              React application
remotion-studio/       Remotion preview and render server
docker-compose.yml     Service orchestration
```

## License

Private. All rights reserved.
