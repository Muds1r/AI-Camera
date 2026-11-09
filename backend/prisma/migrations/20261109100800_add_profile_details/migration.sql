-- AlterTable
ALTER TABLE "users" ADD COLUMN "address" TEXT,
ADD COLUMN "id_card_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_id_card_number_key" ON "users"("id_card_number");
