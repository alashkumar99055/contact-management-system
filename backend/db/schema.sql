-- TaskFlow — reference schema
-- The application auto-creates and migrates this schema via Database.java initSchema().
-- This file is for documentation and manual inspection only.

CREATE TABLE IF NOT EXISTS authentication (
    id            UUID        PRIMARY KEY,
    username      TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id         UUID      PRIMARY KEY,
    user_id    UUID      NOT NULL REFERENCES authentication(id) ON DELETE CASCADE,
    name       TEXT      NOT NULL,
    color      TEXT      NOT NULL DEFAULT '#a78bfa',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
    id           UUID      PRIMARY KEY,
    user_id      UUID      NOT NULL REFERENCES authentication(id) ON DELETE CASCADE,
    title        TEXT      NOT NULL,
    description  TEXT,
    status       TEXT      NOT NULL DEFAULT 'pending',   -- 'pending' | 'completed'
    priority     TEXT      NOT NULL DEFAULT 'medium',    -- 'low' | 'medium' | 'high'
    due_date     DATE,
    due_time     TEXT,                                   -- 'HH:MM' or NULL
    category_id  UUID      REFERENCES categories(id) ON DELETE SET NULL,
    tags         TEXT      DEFAULT '',                   -- comma-separated
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id     ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date    ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
