-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "User_email_normalized_check" CHECK (
        length(btrim("email")) > 0 AND "email" = lower(btrim("email"))
    )
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Session_token_hash_check" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$')
);

-- CreateTable
CREATE TABLE "Mindmap" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Mindmap_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Mindmap_title_not_blank_check" CHECK (length(btrim("title")) > 0),
    CONSTRAINT "Mindmap_sequence_positive_check" CHECK ("sequenceNo" > 0)
);

-- CreateTable
CREATE TABLE "Node" (
    "id" UUID NOT NULL,
    "mindmapId" UUID NOT NULL,
    "parentNodeId" UUID,
    "title" VARCHAR(200) NOT NULL,
    "contentMd" TEXT NOT NULL DEFAULT '',
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isCollapsed" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Node_title_not_blank_check" CHECK (length(btrim("title")) > 0),
    CONSTRAINT "Node_revision_non_negative_check" CHECK ("revision" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE UNIQUE INDEX "Mindmap_userId_sequenceNo_key" ON "Mindmap"("userId", "sequenceNo");
CREATE INDEX "Mindmap_userId_updatedAt_idx" ON "Mindmap"("userId", "updatedAt");
CREATE INDEX "Node_mindmapId_idx" ON "Node"("mindmapId");
CREATE INDEX "Node_parentNodeId_idx" ON "Node"("parentNodeId");
CREATE UNIQUE INDEX "Node_one_root_per_mindmap" ON "Node"("mindmapId") WHERE "parentNodeId" IS NULL;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mindmap" ADD CONSTRAINT "Mindmap_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Node" ADD CONSTRAINT "Node_mindmapId_fkey"
    FOREIGN KEY ("mindmapId") REFERENCES "Mindmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Node" ADD CONSTRAINT "Node_parentNodeId_fkey"
    FOREIGN KEY ("parentNodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
