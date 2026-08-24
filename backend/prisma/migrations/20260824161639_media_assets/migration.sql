-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaSource" AS ENUM ('UPLOAD', 'LINK');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "source" "MediaSource" NOT NULL DEFAULT 'UPLOAD',
    "name" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "publicId" TEXT,
    "url" TEXT NOT NULL,
    "bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "format" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_publicId_key" ON "media_assets"("publicId");

-- CreateIndex
CREATE INDEX "media_assets_kind_idx" ON "media_assets"("kind");

-- CreateIndex
CREATE INDEX "media_assets_createdAt_idx" ON "media_assets"("createdAt");
