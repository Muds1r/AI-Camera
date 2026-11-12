-- AlterTable
ALTER TABLE "company" ADD COLUMN "night_start" TEXT NOT NULL DEFAULT '21:00';
ALTER TABLE "company" ADD COLUMN "night_end" TEXT NOT NULL DEFAULT '05:00';

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('active', 'resigned');
CREATE TYPE "ShiftKind" AS ENUM ('day', 'night');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "login_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "employee_code" TEXT;
ALTER TABLE "users" ADD COLUMN "employment_status" "EmploymentStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "users" ADD COLUMN "left_on" DATE;
ALTER TABLE "users" ADD COLUMN "shift" "ShiftKind" NOT NULL DEFAULT 'day';
ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "users_employee_code_key" ON "users"("employee_code");

-- CreateTable
CREATE TABLE "login_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "email" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "login_events_user_id_created_at_idx" ON "login_events"("user_id", "created_at" DESC);
CREATE INDEX "login_events_created_at_idx" ON "login_events"("created_at" DESC);
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "salary_changes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "salary_basic" DOUBLE PRECISION NOT NULL,
    "salary_allowance" DOUBLE PRECISION NOT NULL,
    "salary_deduction" DOUBLE PRECISION NOT NULL,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salary_changes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "salary_changes_user_id_created_at_idx" ON "salary_changes"("user_id", "created_at" DESC);
ALTER TABLE "salary_changes" ADD CONSTRAINT "salary_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
