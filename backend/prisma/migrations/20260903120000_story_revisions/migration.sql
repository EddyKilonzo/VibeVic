-- CreateTable
CREATE TABLE "story_revisions" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dek" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "story_revisions_storyId_createdAt_idx" ON "story_revisions"("storyId", "createdAt");

-- AddForeignKey
ALTER TABLE "story_revisions" ADD CONSTRAINT "story_revisions_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
