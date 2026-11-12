-- AlterTable
ALTER TABLE "leave_types" ADD COLUMN "is_paid" BOOLEAN NOT NULL DEFAULT true;

-- Unpaid leave has no balance. Each approved day is loss of pay.
INSERT INTO "leave_types" ("code", "name", "default_days", "is_paid")
VALUES ('unpaid', 'Unpaid Leave', 0, false)
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "is_paid" = false;

INSERT INTO "leave_balances" ("user_id", "leave_type_id", "allocated")
SELECT u."id", t."id", t."default_days"
FROM "users" u
CROSS JOIN "leave_types" t
WHERE t."code" = 'unpaid'
ON CONFLICT ("user_id", "leave_type_id") DO NOTHING;

-- CreateTable
CREATE TABLE "overtime_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "MedicalRequestStatus" NOT NULL DEFAULT 'pending',
    "review_note" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overtime_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "overtime_requests_user_id_idx" ON "overtime_requests"("user_id");

-- CreateIndex
CREATE INDEX "overtime_requests_status_idx" ON "overtime_requests"("status");

-- CreateIndex
CREATE INDEX "overtime_requests_work_date_idx" ON "overtime_requests"("work_date");

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
