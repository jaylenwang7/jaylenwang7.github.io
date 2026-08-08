PRAGMA foreign_keys = ON;

-- Shared registry of things that may have interactions. Rows mirror the
-- site's subject manifest and are created only after manifest validation.
CREATE TABLE subjects (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL,
  canonical_path  TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Feature-owned aggregate. Keeping this separate means a future interaction
-- can share `subjects` without inheriting like-specific columns.
CREATE TABLE like_counts (
  subject_id  TEXT PRIMARY KEY REFERENCES subjects(id) ON DELETE CASCADE,
  count       INTEGER NOT NULL CHECK (count >= 0)
);

-- The composite key makes likes idempotent under retries and concurrency.
CREATE TABLE likes (
  subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  voter_hash  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (subject_id, voter_hash)
) WITHOUT ROWID;

CREATE TRIGGER likes_after_insert AFTER INSERT ON likes
BEGIN
  INSERT INTO like_counts (subject_id, count)
  VALUES (NEW.subject_id, 1)
  ON CONFLICT(subject_id) DO UPDATE SET count = count + 1;
END;

CREATE TRIGGER likes_after_delete AFTER DELETE ON likes
BEGIN
  UPDATE like_counts
  SET count = count - 1
  WHERE subject_id = OLD.subject_id;
END;
