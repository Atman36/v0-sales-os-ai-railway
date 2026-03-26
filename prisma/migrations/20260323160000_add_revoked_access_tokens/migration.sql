CREATE TABLE IF NOT EXISTS "RevokedAccessToken" (
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RevokedAccessToken_pkey" PRIMARY KEY ("tokenHash")
);

CREATE INDEX IF NOT EXISTS "RevokedAccessToken_expiresAt_idx" ON "RevokedAccessToken"("expiresAt");
