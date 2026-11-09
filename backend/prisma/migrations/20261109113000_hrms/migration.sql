CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent', 'late', 'half_day');
CREATE TYPE "HolidayKind" AS ENUM ('gazetted', 'general_off');
CREATE TYPE "BenefitKind" AS ENUM ('medical', 'opd');

ALTER TABLE "company" ADD COLUMN "logo_url" TEXT;
ALTER TABLE "company" ADD COLUMN "weekend_days" TEXT NOT NULL DEFAULT '0';
ALTER TABLE "company" ADD COLUMN "work_start" TEXT NOT NULL DEFAULT '09:00';

ALTER TABLE "users" ADD COLUMN "department" TEXT;
ALTER TABLE "users" ADD COLUMN "designation" TEXT;
ALTER TABLE "users" ADD COLUMN "salary_basic" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "salary_allowance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "salary_deduction" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "medical_limit" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "opd_limit" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "clock_enabled" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

ALTER TABLE "attendance" ADD COLUMN "clock_in" TIMESTAMPTZ(6);
ALTER TABLE "attendance" ADD COLUMN "clock_out" TIMESTAMPTZ(6);
ALTER TABLE "attendance" ADD COLUMN "status" "AttendanceStatus" NOT NULL DEFAULT 'present';
CREATE INDEX "attendance_work_date_idx" ON "attendance"("work_date");

ALTER TABLE "medical_requests" ADD COLUMN "kind" "BenefitKind" NOT NULL DEFAULT 'medical';
ALTER TABLE "medical_requests" ADD COLUMN "amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE "holidays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "holiday_on" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "HolidayKind" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "holidays_holiday_on_key" ON "holidays"("holiday_on");

CREATE TABLE "leave_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_days" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leave_types_code_key" ON "leave_types"("code");

INSERT INTO "leave_types" ("code", "name", "default_days") VALUES
  ('pto', 'Paid Time Off', 14),
  ('sick', 'Sick Leave', 8),
  ('bereavement', 'Bereavement Leave', 3);

CREATE TABLE "leave_balances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "allocated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leave_balances_user_id_leave_type_id_key" ON "leave_balances"("user_id", "leave_type_id");
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "leave_balances" ("user_id", "leave_type_id", "allocated")
SELECT u."id", t."id", t."default_days" FROM "users" u CROSS JOIN "leave_types" t;

CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "MedicalRequestStatus" NOT NULL DEFAULT 'pending',
    "review_note" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "leave_requests_user_id_idx" ON "leave_requests"("user_id");
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "profile_update_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "changes" JSONB NOT NULL,
    "status" "MedicalRequestStatus" NOT NULL DEFAULT 'pending',
    "review_note" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profile_update_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "profile_update_requests_user_id_idx" ON "profile_update_requests"("user_id");
CREATE INDEX "profile_update_requests_status_idx" ON "profile_update_requests"("status");
ALTER TABLE "profile_update_requests" ADD CONSTRAINT "profile_update_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_update_requests" ADD CONSTRAINT "profile_update_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "detail" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
