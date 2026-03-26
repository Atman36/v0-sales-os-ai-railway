DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'User'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'passwordResetTokenHash'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "passwordResetTokenHash" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'User'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'passwordResetExpiresAt'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);
  END IF;
END $$;
