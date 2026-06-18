-- Sales FAQ / playbook entries for reps (managed by super admins).
-- ADDITIVE ONLY. Run against prod (Supabase SQL editor) BEFORE deploying. Idempotent.
-- Do NOT use `prisma db push` on prod — it drops legacy tables.

CREATE TABLE IF NOT EXISTS "Faq" (
  "id"         TEXT PRIMARY KEY,
  "question"   TEXT NOT NULL,
  "answer"     TEXT NOT NULL,
  "category"   TEXT,
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMP NOT NULL DEFAULT now()
);

-- Starter examples (edit or delete these). Only inserted if the table is empty.
INSERT INTO "Faq" ("id", "question", "answer", "category", "sortOrder")
SELECT * FROM (VALUES
  ('faq_seed_pricing', 'How is RevFactor priced?', 'Starter content — edit me. Confirm the current pricing/fee structure with Fede before quoting an owner.', 'Pricing', 0),
  ('faq_seed_objection', 'The owner says they can manage pricing themselves — why use RevFactor?', 'Starter content — edit me. RevFactor''s revenue management adjusts pricing daily against live market data (RevPAR Index as the north-star metric), which most self-managing owners can''t match by hand.', 'Objections', 0),
  ('faq_seed_onboarding', 'How long does onboarding take?', 'Starter content — edit me. Add the typical onboarding timeline here.', 'Onboarding', 0)
) AS v("id","question","answer","category","sortOrder")
WHERE NOT EXISTS (SELECT 1 FROM "Faq");
