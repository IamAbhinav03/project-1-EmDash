# EmDash Audio Editor Wiki

This wiki describes how the current repository works, how the frontend and backend fit together, and where to make common changes. It follows the checked-in implementation; features described as planned or placeholder are not implemented yet.

## Start here

- [Architecture and request/data flow](Architecture.md)
- [Frontend structure and editor behavior](Frontend.md)
- [Audio, clips, playback, and export](Audio-and-Projects.md)
- [FastAPI backend and API reference](Backend.md)
- [Development setup and extension guide](Development.md)

## At a glance

EmDash is a browser-based multitrack audio editor. The React/Vite frontend owns editing state, decodes audio through the Web Audio API, schedules playback, and renders WAV exports. FastAPI stores project records in PostgreSQL. Local audio uploads use disk storage; Vercel deployments upload directly to Vercel Blob. Vite proxies `/api` requests to the local API while developing.

```text
Browser UI (React)
  ├─ editor state, timeline interactions, history
  ├─ Web Audio API: decode, playback, offline render
  └─ HTTP /api ── Vite proxy in development ── FastAPI
                                             ├─ PostgreSQL projects
                                             └─ local data/assets/*
```

## Current feature boundary

Implemented: track and clip editing, file import, playback, per-track gain/pan/mute/solo, clip fades, split/trim/move, undo/redo, project save/open, and stereo 16-bit PCM WAV export. The Effects view explains that realtime processing is not enabled. The displayed BPM and time signature are currently static UI values; loop state exists internally but has no user control and defaults off.
