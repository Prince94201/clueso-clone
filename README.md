# Clueso

Monorepo:
- `client/` — Next.js frontend
- `server/` — Node.js/Express + Apollo GraphQL backend

## Quick start

### Prerequisites
- Node.js (LTS)
- `pnpm` (frontend) and `npm` (backend)
- Optional:
  - `ffmpeg`
  - `whisper-cli` + model file
  - Piper (local TTS)

### Install dependencies
- `cd client && pnpm install`
- `cd server && npm install`

### Environment variables
Do **not** commit `.env*` files.

- `client/.env.local`
  - `NEXT_PUBLIC_API_URL=http://localhost:5001`

- `server/.env`
  - `PORT=5001`
  - Optional:
    - `OPENAI_API_KEY=...`
    - `WHISPER_CLI_PATH=whisper-cli`
    - `WHISPER_MODEL_PATH=server/models/ggml-base.en.bin`
    - `PIPER_BIN_PATH=...`
    - `PIPER_MODEL_PATH=...`
    - `FFMPEG_PATH=ffmpeg`

### Run locally
- Backend: `cd server && npm run dev` (http://localhost:5001)
- Frontend: `cd client && pnpm dev` (http://localhost:3000)

## Project structure
```
clueso/
  client/         # Next.js app
  server/         # Express + Apollo GraphQL API
    models/       # Local AI models (e.g. Whisper)
    src/
      routes/
      controllers/
      graphql/
      services/   # AI + video/audio processing services
    uploads/      # runtime artifacts
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
└──────────────┬────────────┘
               │ calls
               v
┌───────────────────────────┐
│      Service layer         │
│ (server/src/services/*)    │
│  - aiService.js            │
│  - videoService.js         │
│  - fileService.js          │
└──────────────┬────────────┘
               │ reads/writes
               v
┌───────────────────────────┐
│   Local filesystem store   │
│  (server/uploads/*, models)│
└───────────────────────────┘
```

AI component:
- `server/src/services/aiService.js`
  - Transcription: local `whisper-cli` (preferred)
  - Script improvement + docs: OpenAI chat completions
  - Voiceover: Piper → macOS `say` → OpenAI TTS fallback

## Assumptions & design decisions
- Monorepo to keep evaluator setup simple and co-locate local assets (`models/`, `uploads/`).
- Prefer local AI (Whisper/Piper) to reduce API cost/quota; OpenAI is used as fallback.
- Runtime artifacts are stored on disk (`server/uploads/*`) for local/dev; production would use object storage + a job queue.

## Troubleshooting
- Transcription: verify `WHISPER_CLI_PATH` and `WHISPER_MODEL_PATH`.
- Voiceover: set Piper env vars (or macOS uses `say`); otherwise OpenAI TTS needs `OPENAI_API_KEY`.
- Media conversion: ensure `ffmpeg` is installed (or set `FFMPEG_PATH`).

## Future scope (video editing)
- Timeline-based editor (trim, split, merge)
- Transitions and basic effects (fade, blur, color adjustments)
- Captions/subtitles (auto-generate + manual edit, export SRT/VTT)
- Audio tools (noise reduction, normalize, background music)
- Templates/presets for quick edits
- Background processing queue + progress tracking for long renders
- Export profiles (social presets, bitrate/resolution control)
- Collaboration/versioning (drafts, history, comments)