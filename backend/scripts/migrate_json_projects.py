"""Import legacy project JSON into PostgreSQL without deleting source files."""
from __future__ import annotations

import json
from pathlib import Path
from psycopg.types.json import Jsonb
from app.database import connection

projects_dir = Path(__file__).resolve().parents[1] / 'data' / 'projects'
with connection() as conn:
    for path in sorted(projects_dir.glob('*.json')):
        project = json.loads(path.read_text(encoding='utf-8'))
        conn.execute('''
            INSERT INTO projects (id, name, tracks, assets, updated_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        ''', (path.stem, project['name'], Jsonb(project.get('tracks', [])), Jsonb(project.get('assets', [])), project['updatedAt']))
        print(f'Imported {path.stem}')
