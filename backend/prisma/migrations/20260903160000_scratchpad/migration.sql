-- CreateTable
CREATE TABLE "scratchpad" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "body" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scratchpad_pkey" PRIMARY KEY ("id")
);
