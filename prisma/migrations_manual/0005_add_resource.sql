-- Shareable files/links (contract, service agreement, decks) for the FAQ Resources panel.
-- ADDITIVE ONLY. Run against prod (Supabase SQL editor) BEFORE deploying. Idempotent.
-- Do NOT use `prisma db push` on prod — it drops legacy tables.

CREATE TABLE IF NOT EXISTS "Resource" (
  "id"          TEXT PRIMARY KEY,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "url"         TEXT NOT NULL,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMP NOT NULL DEFAULT now()
);

-- No seed rows: add the real document links from the admin UI (FAQ → Resources → + Add),
-- e.g. the standard service agreement and the separate $320 referral contract.
