-- CreateEnum
CREATE TYPE "delFlag" AS ENUM ('ACTIVE', 'DELETED');

-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN     "delflag" "delFlag" NOT NULL DEFAULT 'ACTIVE';
