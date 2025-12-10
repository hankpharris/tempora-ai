/*
  Warnings:

  - You are about to drop the column `name` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "events" ALTER COLUMN "start" SET DATA TYPE TIMESTAMPTZ[],
ALTER COLUMN "end" SET DATA TYPE TIMESTAMPTZ[];

-- AlterTable
ALTER TABLE "users" DROP COLUMN "name",
ADD COLUMN     "fname" TEXT,
ADD COLUMN     "lname" TEXT;
