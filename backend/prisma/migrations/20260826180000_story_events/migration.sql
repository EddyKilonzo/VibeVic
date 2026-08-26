-- CreateEnum
CREATE TYPE "ReadEventKind" AS ENUM ('VIEW', 'READ', 'LISTEN');

-- CreateTable
CREATE TABLE "story_events" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "kind" "ReadEventKind" NOT NULL,
    "session" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "story_events_storyId_kind_session_day_key" ON "story_events"("storyId", "kind", "session", "day");

-- CreateIndex
CREATE INDEX "story_events_storyId_kind_idx" ON "story_events"("storyId", "kind");

-- CreateIndex
CREATE INDEX "story_events_occurredAt_idx" ON "story_events"("occurredAt");

-- AddForeignKey
ALTER TABLE "story_events" ADD CONSTRAINT "story_events_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
