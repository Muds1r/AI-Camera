ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'finance';

ALTER TABLE "medical_requests" ADD COLUMN "submitted_by" UUID;
ALTER TABLE "medical_requests" ADD CONSTRAINT "medical_requests_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "policies_created_at_idx" ON "policies"("created_at" DESC);
ALTER TABLE "policies" ADD CONSTRAINT "policies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
