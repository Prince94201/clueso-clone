# Clueso

Monorepo:
- `client/` — Next.js frontend (UI & Dashboard)
- `server/` — Node.js/Express + Apollo GraphQL backend
- `ai/` — Dedicated AI service library (transcription, summary, vision, voiceover)

## Quick start

### Prerequisites
- Node.js (LTS)
- `pnpm` (frontend) and `npm` (backend)
- `ffmpeg` (installed via system or dependencies handled by `@ffmpeg-installer`)

### Install dependencies
- Frontend: `cd client && pnpm install`
- Backend: `cd server && npm install`
- AI Library: `cd ai && npm install`

### Environment variables
Do **not** commit `.env*` files.

- `client/.env.local`
  - `NEXT_PUBLIC_API_URL=http://localhost:5001`

- `server/.env`
  - `PORT=5001`
  - `GROQ_API_KEY=...` (Primary for Text/Vision/Audio)
  - `OPENAI_API_KEY=...` (Fallback)
  - `UPLOAD_PATH=./uploads`

### Run locally
- Backend: `cd server && npm run dev` (http://localhost:5001)
- Frontend: `cd client && pnpm dev` (http://localhost:3000)

## Features

### AI-Powered Analysis
- **Transcription**: Uses Groq (Whisper) for fast, accurate audio transcription.
- **Visual Understanding**: Analyzes video frames (Visual Actions) combined with audio to generate comprehensive context.
- **AI Summary**: Generates concise summaries of the video content.
- **Voiceover**: Generates professional voiceovers using AI (OpenAI TTS).
- **Auto-Documentation**: Creates step-by-step guides based on video content.

### Video Management
- **Recording**: Record screen/camera directly from the browser.
- **Export**: 
  - **Download Video**: Direct download of your video file.
  - **Share**: Generate public share links.
- **Dashboard**: Organized library with status tracking (Processing, Ready).

## Project structure
```
clueso/
  client/         # Next.js app (Dashboard, Video Player, AI UI)
  server/         # Express + GraphQL API
    src/
      services/   # General services (video, file)
      graphql/    # Schema & resolvers
      ai/         # (Legacy reference, logic moved to root ai/ folder)
  ai/             # Dedicated AI Module
    controller.js # AI logic (transcribe, summarize, export)
    service.js    # Integrations (Groq, OpenAI)
    routes.js     # AI endpoints
```

## Architecture overview

```
┌───────────────────────────┐
│        Next.js UI          │
│        (client/)           │
└──────────────┬────────────┘
               │ HTTP (GraphQL + REST)
               v
┌───────────────────────────┐
│   Node/Express + Apollo    │
│          (server/)         │
└──────┬─────────────┬──────┘
       │ calls       │ imports
       v             v
┌──────────────┐  ┌──────────────┐
│ Service Layer│  │  AI Module   │
│ (server/src) │  │    (ai/)     │
└──────┬───────┘  └──────┬───────┘
       │ reads/writes    │ processes
       v                 v
┌───────────────────────────┐
│   Local filesystem store   │
│  (server/uploads/*)        │
└───────────────────────────┘
```

## AI Strategy
- **Groq-First**: We prioritize Groq for its speed in inference (Llama models) and transcription (Whisper).
- **Hybrid Analysis**: Videos without audio are analyzed visually (frame-by-frame) to ensure summaries are always relevant.
- **Fallback**: OpenAI is used if Groq services are unavailable or for specific TTS needs.

## Troubleshooting
- **Port Conflicts**: If port 5001 is in use, check for zombie node processes (`lsof -i :5001`) or check if multiple terminals are running the server.
- **AI Errors**: Ensure `GROQ_API_KEY` is set in `server/.env`.
- **Download Issues**: The "Export" button forces a download; if it opens in a tab, ensure the server CORS headers are correct (handled by proxy/backend).