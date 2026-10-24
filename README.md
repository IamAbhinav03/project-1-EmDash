# EmDash multi-track audio editor

The application is split into a React + Vite + Tailwind frontend and a Python FastAPI backend.

## Run locally

Start the API in one terminal:

```bash
python3 -m pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload --port 8000
```

Start the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to FastAPI at port 8000. Projects and uploaded audio are stored in `backend/data/`.
