# EmDash API

Run from the repository root:

```bash
python3 -m pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload --port 8000
```

Projects and uploaded audio are stored under `backend/data/`.
