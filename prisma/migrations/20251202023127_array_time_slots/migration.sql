/*
  Warnings:

  - The `start` column on the `events` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `end` column on the `events` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "events" DROP COLUMN "start",
ADD COLUMN     "start" TIMESTAMP(3)[],
DROP COLUMN "end",
ADD COLUMN     "end" TIMESTAMP(3)[];
