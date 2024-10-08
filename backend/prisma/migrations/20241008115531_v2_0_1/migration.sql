/*
  Warnings:

  - You are about to drop the column `delflag` on the `medical_records` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "medical_records" DROP COLUMN "delflag",
ADD COLUMN     "delFlag" "delFlag" NOT NULL DEFAULT 'ACTIVE';
