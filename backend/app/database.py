from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg.rows import dict_row


def database_url() -> str:
    url = os.getenv('DATABASE_URL')
    if not url:
        raise RuntimeError('DATABASE_URL must point to a PostgreSQL database')
    return url


@contextmanager
def connection() -> Iterator[psycopg.Connection]:
    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS projects (
                id varchar(80) PRIMARY KEY,
                name varchar(120) NOT NULL,
                tracks jsonb NOT NULL DEFAULT '[]'::jsonb,
                assets jsonb NOT NULL DEFAULT '[]'::jsonb,
                updated_at timestamptz NOT NULL DEFAULT now()
            )
        ''')
        yield conn
