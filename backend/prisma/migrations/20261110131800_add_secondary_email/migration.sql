-- Recovery contact used later for password-reset codes.
ALTER TABLE "users" ADD COLUMN "secondary_email" TEXT;
