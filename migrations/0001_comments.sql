CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post TEXT NOT NULL,
  nickname TEXT NOT NULL,
  email TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'deleted')),
  created_at TEXT NOT NULL,
  moderated_at TEXT
);
CREATE INDEX IF NOT EXISTS comments_post_status_created ON comments(post, status, created_at);
CREATE INDEX IF NOT EXISTS comments_status_created ON comments(status, created_at);
