-- Rep profile fields shown on the public booking page.
-- ADDITIVE ONLY. Run this against prod (Supabase SQL editor) BEFORE deploying.
-- Do NOT use `prisma db push` on prod — it drops legacy tables. Apply this SQL instead.
-- Idempotent: safe to re-run.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hometown" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "basedIn" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "strExperience" TEXT;
