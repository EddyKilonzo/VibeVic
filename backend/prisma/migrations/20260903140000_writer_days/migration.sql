-- AlterTable
ALTER TABLE "users" ADD COLUMN "awayNoticeAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "writer_days" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "writer_days_pkey" PRIMARY KEY ("userId","day")
);

-- CreateIndex
CREATE INDEX "writer_days_userId_day_idx" ON "writer_days"("userId", "day");

-- AddForeignKey
ALTER TABLE "writer_days" ADD CONSTRAINT "writer_days_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
