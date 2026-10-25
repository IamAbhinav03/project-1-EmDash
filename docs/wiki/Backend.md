# FastAPI backend and storage

`backend/app/main.py` defines the API. `backend/app/database.py` connects to PostgreSQL through `DATABASE_URL` and creates the `projects` table when a connection is opened. Project names and timestamps are columns; tracks and asset metadata are JSONB columns. IDs are validated before queries, and SQL parameters are bound through psycopg.

Local audio uploads are stored under gitignored `backend/data/assets/`. The Vercel build uses direct browser uploads to Vercel Blob, so large audio does not pass through a Function. Project records hold each asset URL and metadata; decoded AudioBuffers remain in the browser only.

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/health` | Checks database connectivity. |
| `GET` | `/api/projects` | Lists projects, newest first. |
| `GET` | `/api/projects/{id}` | Returns a project or `404`. |
| `PUT` | `/api/projects/{id}` | Inserts or updates a project and timestamp. |
| `POST` | `/api/assets` | Local multipart audio upload, up to 250 MiB. |
| `GET` | `/api/assets/{id}` | Serves a local stored asset. |
| `POST` | `/api/blob-upload` | Vercel upload token endpoint for direct Blob uploads. |

The project name must have 1–120 characters; IDs allow 1–80 letters, digits, underscores, or hyphens. Uploaded file types are checked by MIME or suffix. FastAPI's interactive docs are at `/docs` during local development.

## Existing project migration

Run `DATABASE_URL=... PYTHONPATH=backend python3 backend/scripts/migrate_json_projects.py`. This imports each legacy `backend/data/projects/*.json` record once and leaves the JSON files untouched as backups. Existing local audio files remain on the local machine; moving those projects to a hosted database does not upload their audio to Blob.

## Deployment

The Vercel project needs a PostgreSQL `DATABASE_URL` and a connected Vercel Blob store. The repository's `api/index.py` exposes FastAPI; `api/blob-upload.js` signs direct uploads. Vercel builds the Vite frontend from `frontend/` and rewrites `/api/*` to the functions. No authentication or user separation is implemented, so do not place private projects or audio in a publicly accessible deployment.
