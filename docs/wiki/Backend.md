# FastAPI backend

## Application and storage

The API is defined in `backend/app/main.py` and is launched from the repository root with:

```sh
uvicorn app.main:app --app-dir backend --reload --port 8000
```

On import, the module creates `backend/data/projects/` and `backend/data/assets/` if needed. Both are runtime data directories and are gitignored. Project records are JSON files named `{project_id}.json`; uploads are files named with a generated 32-character lowercase UUID and their original extension (or `.audio` when no extension exists). The backend does not keep a database or process audio.

## HTTP API

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/health` | Returns service status. |
| `GET` | `/api/projects` | Reads valid project JSON files and returns `{id, name, updatedAt}` summaries, newest first. Invalid/unreadable records are skipped. |
| `GET` | `/api/projects/{project_id}` | Returns the complete project JSON or `404`. |
| `PUT` | `/api/projects/{project_id}` | Validates and writes project name, tracks, and assets; sets `updatedAt` in UTC. Creates/overwrites that project file. |
| `POST` | `/api/assets` | Accepts multipart field `file`, validates an audio type/extension, streams it to disk, returns asset metadata. Success is `201`. |
| `GET` | `/api/assets/{asset_id}` | Serves the matching stored asset file or returns `404`. |

FastAPI's interactive API documentation is available at `/docs` while the server is running.

## Validation and errors

`ProjectPayload` requires a name from 1 to 120 characters. `tracks` and `assets` are arrays of JSON objects and default to empty arrays. Project IDs must match 1–80 letters, digits, underscores, or hyphens. Asset IDs must be 32 lowercase hexadecimal characters.

Uploads are accepted when the MIME type begins with `audio/` or the filename suffix is one of `.wav`, `.mp3`, `.m4a`, `.ogg`, `.flac`, `.aac`, `.webm`. Files larger than 250 MiB are rejected with `413`; unsupported files receive `415`. Upload is read in 1 MiB chunks and partial over-limit files are removed.

The frontend's API wrapper surfaces FastAPI's JSON `detail` value when available. Common statuses include `400` for malformed IDs, `404` for missing project/asset, `413` for size limit, `415` for unsupported upload, and `422` for request validation.

## CORS and local development

CORS allows localhost and 127.0.0.1 on ports 5173 and 4173. Vite proxies `/api` to the backend during development, so the browser generally talks to the frontend origin and the proxy forwards requests.

## Operational boundaries

This is a local-file persistence backend, not a multi-user production service. There is no authentication, database, project delete route, asset delete route, upload quota, or orphan cleanup. Asset names are returned as metadata; disk names are generated IDs. The project JSON stores references to assets but does not package or duplicate the audio bytes.
