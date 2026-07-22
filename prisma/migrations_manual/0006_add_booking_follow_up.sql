-- Auditable post-call emails sent from the CRM.
-- ADDITIVE ONLY. Run against prod (Supabase SQL editor) BEFORE deploying.
-- Do NOT use `prisma db push` on prod — it drops legacy tables.

CREATE TABLE IF NOT EXISTS "BookingFollowUp" (
  "id"                TEXT PRIMARY KEY,
  "bookingId"         TEXT NOT NULL,
  "templateKey"       TEXT NOT NULL,
  "subject"           TEXT NOT NULL,
  "body"              TEXT NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'sending',
  "providerMessageId" TEXT,
  "error"             TEXT,
  "sentByUserId"      TEXT,
  "sentByName"        TEXT,
  "sentByEmail"       TEXT,
  "createdAt"         TIMESTAMP NOT NULL DEFAULT now(),
  "sentAt"            TIMESTAMP,
  CONSTRAINT "BookingFollowUp_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "BookingFollowUp_bookingId_createdAt_idx"
  ON "BookingFollowUp" ("bookingId", "createdAt");
