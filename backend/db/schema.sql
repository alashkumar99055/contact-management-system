-- ContactFlow — PostgreSQL reference schema
-- The application auto-creates this schema via Database.java initSchema().
-- This file is for documentation and manual inspection only.
-- To apply manually: psql -U postgres -d contactflow -f schema.sql

CREATE TABLE IF NOT EXISTS authentication (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES authentication(id) ON DELETE CASCADE,
    name       TEXT        NOT NULL,
    phone      TEXT        NOT NULL DEFAULT '',
    email      TEXT        NOT NULL DEFAULT '',
    address    TEXT        NOT NULL DEFAULT '',
    category   TEXT        NOT NULL DEFAULT '',   -- Family | Friends | Work | College | Other
    notes      TEXT        NOT NULL DEFAULT '',
    favorite   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_id  ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name     ON contacts(user_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_contacts_favorite ON contacts(user_id, favorite);
CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts(user_id, category);

-- Migration (safe for existing deployments)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT FALSE;
