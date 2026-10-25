# project-1-EmDash

EmDash multi-track audio editor

The application is split into a React + Vite + Tailwind frontend and a Python FastAPI backend.

## Documentation

See the [EmDash repository wiki](docs/wiki/Home.md) for an architecture overview, frontend and audio walkthroughs, backend API and persistence details, and development notes.

## Run locally

Create a PostgreSQL database and set `DATABASE_URL`. Start the API in one terminal:

```bash
python3 -m pip install -r backend/requirements.txt
DATABASE_URL=postgresql://localhost/audio_editor uvicorn app.main:app --app-dir backend --reload --port 8000
```

Start the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to FastAPI at port 8000. Projects are stored in PostgreSQL; local uploaded audio remains in `backend/data/assets/`. Vercel deployments use Vercel Blob for audio.

To import existing JSON projects into PostgreSQL without removing the source files, run `DATABASE_URL=... PYTHONPATH=backend python3 backend/scripts/migrate_json_projects.py`.
