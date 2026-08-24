-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('CONFIDENTIAL', 'PRIVATE', 'PUBLISHABLE');

-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "IdeaStage" AS ENUM ('SPARK', 'RESEARCHING', 'PITCHED', 'COMMISSIONED', 'DROPPED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('UNVERIFIED', 'VERIFYING', 'VERIFIED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "EntityKind" AS ENUM ('PERSON', 'ORGANISATION', 'LOCATION', 'PROJECT', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "PortfolioClass" AS ENUM ('STANDARD', 'SIGNATURE', 'INVESTIGATION', 'AWARD_SUBMISSION');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dek" TEXT NOT NULL,
    "genreSlug" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "StoryStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "readingMinutes" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" BOOLEAN NOT NULL DEFAULT false,
    "publication" TEXT,
    "sourceUrl" TEXT,
    "cover" TEXT,
    "body" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_stats" (
    "storyId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "reads" INTEGER NOT NULL DEFAULT 0,
    "listens" INTEGER NOT NULL DEFAULT 0,
    "avgListenSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_stats_pkey" PRIMARY KEY ("storyId")
);

-- CreateTable
CREATE TABLE "genres" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parentSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "publications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awards" (
    "id" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coverStoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_stories" (
    "collectionId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_stories_pkey" PRIMARY KEY ("collectionId","storyId")
);

-- CreateTable
CREATE TABLE "portfolio_entries" (
    "storyId" TEXT NOT NULL,
    "class" "PortfolioClass" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_entries_pkey" PRIMARY KEY ("storyId")
);

-- CreateTable
CREATE TABLE "style_guide_entries" (
    "id" TEXT NOT NULL,
    "preferred" TEXT NOT NULL,
    "avoid" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "why" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_guide_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ideas" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "genre" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "stage" "IdeaStage" NOT NULL DEFAULT 'SPARK',
    "storyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pitches" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT,
    "title" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL DEFAULT '',
    "whatIsKnown" TEXT NOT NULL DEFAULT '',
    "whatIsUnknown" TEXT NOT NULL DEFAULT '',
    "targetPublication" TEXT,
    "deadline" TIMESTAMP(3),
    "storyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pitches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pitch_sources" (
    "pitchId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pitch_sources_pkey" PRIMARY KEY ("pitchId","sourceId")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "organisation" TEXT,
    "url" TEXT,
    "accessedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "SourceStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "visibility" "Visibility" NOT NULL DEFAULT 'CONFIDENTIAL',
    "protectedIdentity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "speakerRole" TEXT,
    "saidAt" TIMESTAMP(3),
    "sourceId" TEXT,
    "interviewId" TEXT,
    "keyQuote" BOOLEAN NOT NULL DEFAULT false,
    "status" "SourceStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "interviewee" TEXT NOT NULL,
    "role" TEXT,
    "purpose" TEXT NOT NULL DEFAULT '',
    "conductedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "followUps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visibility" "Visibility" NOT NULL DEFAULT 'CONFIDENTIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "kind" "EntityKind" NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT NOT NULL DEFAULT '',
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "supports" TEXT NOT NULL DEFAULT '',
    "sourceId" TEXT,
    "reference" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_events" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "what" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "storyId" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadlines" (
    "id" TEXT NOT NULL,
    "storyId" TEXT,
    "label" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_sources" (
    "storyId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_sources_pkey" PRIMARY KEY ("storyId","sourceId")
);

-- CreateTable
CREATE TABLE "story_quotes" (
    "storyId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_quotes_pkey" PRIMARY KEY ("storyId","quoteId")
);

-- CreateTable
CREATE TABLE "story_interviews" (
    "storyId" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_interviews_pkey" PRIMARY KEY ("storyId","interviewId")
);

-- CreateTable
CREATE TABLE "story_evidence" (
    "storyId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_evidence_pkey" PRIMARY KEY ("storyId","evidenceId")
);

-- CreateTable
CREATE TABLE "story_timeline_events" (
    "storyId" TEXT NOT NULL,
    "timelineEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_timeline_events_pkey" PRIMARY KEY ("storyId","timelineEventId")
);

-- CreateTable
CREATE TABLE "evidence_entities" (
    "evidenceId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_entities_pkey" PRIMARY KEY ("evidenceId","entityId")
);

-- CreateTable
CREATE TABLE "timeline_event_entities" (
    "timelineEventId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_event_entities_pkey" PRIMARY KEY ("timelineEventId","entityId")
);

-- CreateTable
CREATE TABLE "timeline_event_evidence" (
    "timelineEventId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_event_evidence_pkey" PRIMARY KEY ("timelineEventId","evidenceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "stories_slug_key" ON "stories"("slug");

-- CreateIndex
CREATE INDEX "stories_status_publishedAt_idx" ON "stories"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "stories_genreSlug_idx" ON "stories"("genreSlug");

-- CreateIndex
CREATE INDEX "genres_parentSlug_idx" ON "genres"("parentSlug");

-- CreateIndex
CREATE UNIQUE INDEX "collection_stories_collectionId_position_key" ON "collection_stories"("collectionId", "position");

-- CreateIndex
CREATE INDEX "ideas_stage_idx" ON "ideas"("stage");

-- CreateIndex
CREATE INDEX "sources_visibility_idx" ON "sources"("visibility");

-- CreateIndex
CREATE INDEX "quotes_visibility_idx" ON "quotes"("visibility");

-- CreateIndex
CREATE INDEX "interviews_visibility_idx" ON "interviews"("visibility");

-- CreateIndex
CREATE INDEX "entities_visibility_idx" ON "entities"("visibility");

-- CreateIndex
CREATE INDEX "evidence_items_visibility_idx" ON "evidence_items"("visibility");

-- CreateIndex
CREATE INDEX "timeline_events_occurredAt_idx" ON "timeline_events"("occurredAt");

-- CreateIndex
CREATE INDEX "notes_visibility_idx" ON "notes"("visibility");

-- CreateIndex
CREATE INDEX "deadlines_dueAt_idx" ON "deadlines"("dueAt");

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_genreSlug_fkey" FOREIGN KEY ("genreSlug") REFERENCES "genres"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_stats" ADD CONSTRAINT "story_stats_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "genres" ADD CONSTRAINT "genres_parentSlug_fkey" FOREIGN KEY ("parentSlug") REFERENCES "genres"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_stories" ADD CONSTRAINT "collection_stories_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_stories" ADD CONSTRAINT "collection_stories_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_entries" ADD CONSTRAINT "portfolio_entries_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pitches" ADD CONSTRAINT "pitches_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "ideas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pitches" ADD CONSTRAINT "pitches_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pitch_sources" ADD CONSTRAINT "pitch_sources_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "pitches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pitch_sources" ADD CONSTRAINT "pitch_sources_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_sources" ADD CONSTRAINT "story_sources_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_sources" ADD CONSTRAINT "story_sources_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_quotes" ADD CONSTRAINT "story_quotes_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_quotes" ADD CONSTRAINT "story_quotes_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_interviews" ADD CONSTRAINT "story_interviews_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_interviews" ADD CONSTRAINT "story_interviews_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_evidence" ADD CONSTRAINT "story_evidence_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_evidence" ADD CONSTRAINT "story_evidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_timeline_events" ADD CONSTRAINT "story_timeline_events_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_timeline_events" ADD CONSTRAINT "story_timeline_events_timelineEventId_fkey" FOREIGN KEY ("timelineEventId") REFERENCES "timeline_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_entities" ADD CONSTRAINT "evidence_entities_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_entities" ADD CONSTRAINT "evidence_entities_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_event_entities" ADD CONSTRAINT "timeline_event_entities_timelineEventId_fkey" FOREIGN KEY ("timelineEventId") REFERENCES "timeline_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_event_entities" ADD CONSTRAINT "timeline_event_entities_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_event_evidence" ADD CONSTRAINT "timeline_event_evidence_timelineEventId_fkey" FOREIGN KEY ("timelineEventId") REFERENCES "timeline_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_event_evidence" ADD CONSTRAINT "timeline_event_evidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
