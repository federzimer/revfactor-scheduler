-- "Bookable" flag: controls whether a teammate shows in the lead-facing scheduler and
-- can be booked, INDEPENDENT of `active` (which also gates admin sign-in — so a rep can
-- stop taking calls without losing their login).
-- ADDITIVE ONLY. Run against prod (Supabase SQL editor) BEFORE deploying. Idempotent.
-- Do NOT use `prisma db push` on prod — it drops legacy tables.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bookable" BOOLEAN NOT NULL DEFAULT true;

-- Federico + Gaston are admins who aren't taking discovery calls — hide them from the scheduler.
UPDATE "User" SET "bookable" = false WHERE email IN ('federico@blackbirdhm.com', 'gaston@blackbirdhm.com');
