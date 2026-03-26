WITH ranked_insights AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "callId", type
      ORDER BY "createdAt" ASC, id ASC
    ) AS row_number
  FROM "AIInsight"
  WHERE "callId" IS NOT NULL
)
DELETE FROM "AIInsight"
WHERE id IN (
  SELECT id
  FROM ranked_insights
  WHERE row_number > 1
);

CREATE UNIQUE INDEX "AIInsight_callId_type_key" ON "AIInsight"("callId", "type");
