/*
  Warnings:

  - Added the required column `role` to the `Application` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "role" TEXT NOT NULL;
