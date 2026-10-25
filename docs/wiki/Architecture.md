# Architecture and data flow

## Runtime pieces

### Frontend

`frontend/` is a Vite application built with React, TypeScript, Tailwind's Vite plugin, and CSS in `src/index.css`. `src/main.tsx` mounts `App` into the root element. `App.tsx` composes the editor and owns session-level state and Web Audio orchestration. UI components receive state and callbacks through props.

### Backend

`backend/app/main.py` defines the FastAPI application and its HTTP routes. The backend stores project records in PostgreSQL. It keeps uploaded audio in `backend/data/assets/` during local development; Vercel uses Blob storage. It does not process or mix audio.

### Development connection

The Vite dev server runs on port `5173`. Its config forwards paths beginning with `/api` to `http://127.0.0.1:8000`, where Uvicorn serves FastAPI. `VITE_API_URL` can set an explicit API origin; when unset, the frontend uses relative `/api` URLs. FastAPI also allows the local Vite development origins through CORS.

## Repository map

```text
backend/
  app/database.py             PostgreSQL connection and schema
  scripts/migrate_json_projects.py  One-time JSON import
  app/main.py                 FastAPI routes, validation, and disk persistence
  requirements.txt            Python dependencies
  data/                       Runtime project and asset data (gitignored)
frontend/
  src/App.tsx                 Main session state, interactions, audio engine
  src/api.ts                  Client types and HTTP wrapper
  src/audio.ts                WAV PCM encoder
  src/editorModel.ts          Track/asset helpers and time formatting
  src/components/             Transport, timeline, inspector, waveform
  src/hooks/                  Project operations and undo/redo history
  src/index.css               Global editor layout and visual styling
  src/main.tsx                React entry point
  vite.config.ts              Dev server and API proxy
  package.json                Frontend scripts and dependencies
docs/wiki/                    This repository guide
```

## Core data model

The shared TypeScript model is in `frontend/src/api.ts`:

- A **project** has an id, name, update timestamp, tracks, and asset metadata.
- An **asset** identifies an uploaded source by id, original name, URL, MIME type, and optional size/duration.
- A **track** has an id, display name, color, volume, pan, mute/solo flags, and clips.
- A **clip** references an asset and stores timeline `start`, source `offset`, playable `duration`, and fade-in/fade-out durations. Its timeline end is `start + duration`; its source range is `offset` through `offset + duration`.

The browser's `AudioAsset` extends serializable asset metadata with a decoded `AudioBuffer`. The buffer is runtime-only and is never included in a project save.

## Import, save, and open flow

1. The Media drawer's file input gives selected `File`s to `useProjectManager.importFiles`.
2. Locally, each file is posted to `POST /api/assets` and stored on disk. In a Vercel build, the browser uploads directly to Vercel Blob using a token from `/api/blob-upload`.
3. The frontend fetches the asset URL and calls `AudioContext.decodeAudioData`, creating an in-memory `AudioBuffer` for waveform display and audio operations.
4. Uploaded assets enter the media library. The user chooses a file from a track's selector to add a clip there, or drags it from the media library to a target track and time. The selector appends after the track's last clip.
5. Save sends project name, tracks, and asset metadata to `PUT /api/projects/{project_id}`. PostgreSQL persists them; decoded buffers are omitted.
6. Open fetches project JSON, retrieves each referenced asset, decodes it again, then restores the tracks and project identity.

Project records and audio are stored separately. A saved project depends on its referenced local or Blob assets remaining available.

## State ownership and editing

`App.tsx` owns the working track and asset arrays, selection, playhead, zoom, project details, and UI panels. `tracksRef` and `positionRef` mirror React state for audio scheduling and pointer handlers that need current values without waiting for a render. `useTrackHistory` stores cloned track snapshots for undo and redo. The project manager hook handles upload/load/save/list operations; it receives state setters and the history commit function from the app.

Most discrete track/clip changes go through `commit`, which records a snapshot, clears redo history, updates tracks, and marks the project unsaved. Dragging and trimming update the clip during pointer movement, then store the original snapshot when the pointer is released.

## Design and styling

The UI follows a dark graphite editor layout with muted labels, thin dividers, compact controls, and orange-red selection accents. Structural and component styles are in `frontend/src/index.css`; preserve that visual language when extending panels or controls. Tailwind is installed as a Vite plugin, though the existing editor primarily uses named CSS classes.
