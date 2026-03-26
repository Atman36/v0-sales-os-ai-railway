DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CallTranscript' AND column_name = 'raw'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CallTranscript' AND column_name = 'rawResponse'
  ) THEN
    ALTER TABLE "CallTranscript" RENAME COLUMN "raw" TO "rawResponse";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'CallTranscript'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CallTranscript' AND column_name = 'model'
  ) THEN
    ALTER TABLE "CallTranscript" ADD COLUMN "model" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AIInsight'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AIInsight' AND column_name = 'promptVersion'
  ) THEN
    ALTER TABLE "AIInsight" ADD COLUMN "promptVersion" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AIInsight'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AIInsight' AND column_name = 'provider'
  ) THEN
    ALTER TABLE "AIInsight" ADD COLUMN "provider" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AIInsight'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AIInsight' AND column_name = 'model'
  ) THEN
    ALTER TABLE "AIInsight" ADD COLUMN "model" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AIInsight'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AIInsight' AND column_name = 'rawResponse'
  ) THEN
    ALTER TABLE "AIInsight" ADD COLUMN "rawResponse" JSONB;
  END IF;
END $$;
