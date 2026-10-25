# Development setup and extension guide

## Requirements

- Python 3 with pip
- Node.js and npm
- A browser with Web Audio API support

## Run locally

From the repository root, install backend dependencies and start FastAPI:

```sh
python3 -m pip install -r backend/requirements.txt
DATABASE_URL=postgresql://localhost/audio_editor uvicorn app.main:app --app-dir backend --reload --port 8000
```

In a second terminal, install frontend dependencies and start Vite:

```sh
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite forwards `/api` requests to the API on port 8000. The API docs are at `http://localhost:8000/docs`, and the health endpoint is `http://localhost:8000/api/health`.

## Configuration and runtime data

`VITE_API_URL` optionally sets the API origin for frontend requests. When unset, requests use relative `/api`, which works with the Vite proxy. Project records live in PostgreSQL. Local uploaded audio lives under gitignored `backend/data/assets/`. Set `DATABASE_URL` before starting FastAPI.

## Where common changes belong

- **API route or persistence behavior:** `backend/app/main.py`.
- **Request/response types or API calls:** `frontend/src/api.ts`; keep it aligned with the Pydantic request model.
- **Project import/open/save:** `frontend/src/hooks/useProjectManager.ts`.
- **Clip/track edit mechanics and audio scheduling:** `frontend/src/App.tsx`.
- **Undo/redo snapshots:** `frontend/src/hooks/useTrackHistory.ts`.
- **Track defaults and runtime asset helpers:** `frontend/src/editorModel.ts`.
- **Panel and timeline markup:** the corresponding file in `frontend/src/components/`.
- **Audio conversion/encoding:** `frontend/src/audio.ts` and the audio paths in `App.tsx`.
- **Global visual system and responsive layout:** `frontend/src/index.css`.

## Adding persistent project data

Define the serializable field in the frontend model, make sure project save/open preserves it, and ensure FastAPI's payload accepts and returns it. The current backend stores tracks and assets as JSONB arrays, so it preserves fields without a detailed nested schema. Keep decoded `AudioBuffer`s and other browser objects out of serialized data.

## Current limitations to keep in mind

Effects and automation panels are placeholders. The displayed BPM and 4/4 time signature are not connected to project state. There is no server-side audio processing, user authentication, cloud storage, project/asset deletion, or automatic cleanup of unused uploads. These should be treated as future work rather than existing behavior.
