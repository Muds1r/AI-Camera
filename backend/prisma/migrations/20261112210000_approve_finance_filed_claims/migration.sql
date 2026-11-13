UPDATE "medical_requests"
SET
  "status" = 'approved',
  "reviewed_at" = COALESCE("reviewed_at", CURRENT_TIMESTAMP),
  "reviewed_by" = COALESCE("reviewed_by", "submitted_by"),
  "updated_at" = CURRENT_TIMESTAMP
WHERE "status" = 'pending' AND "submitted_by" IS NOT NULL;
