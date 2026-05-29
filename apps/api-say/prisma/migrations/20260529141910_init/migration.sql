-- CreateEnum
CREATE TYPE "Intent" AS ENUM ('DO', 'NOTE', 'SEND', 'BUY', 'EAT');

-- CreateEnum
CREATE TYPE "DictationState" AS ENUM ('proposed', 'confirmed', 'dispatched', 'cancelled');

-- CreateEnum
CREATE TYPE "Destination" AS ENUM ('DO_THINGS', 'SAY_LIBRARY', 'CLIPBOARD', 'PENDING_BUY', 'PENDING_EAT');

-- CreateEnum
CREATE TYPE "CaptureMode" AS ENUM ('tap', 'drive', 'type');

-- CreateTable
CREATE TABLE "Dictation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "audioPath" TEXT,
    "previewTranscript" TEXT,
    "finalTranscript" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "captureMode" "CaptureMode" NOT NULL DEFAULT 'tap',
    "intent" "Intent" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "proposedPayload" JSONB NOT NULL,
    "editedPayload" JSONB,
    "state" "DictationState" NOT NULL DEFAULT 'proposed',
    "destination" "Destination" NOT NULL,
    "destinationRef" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "usage" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dictation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestBodyHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AiCall" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "callerApp" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cacheReadTokens" INTEGER,
    "cacheWriteTokens" INTEGER,
    "audioSeconds" DOUBLE PRECISION,
    "vectorCount" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "fellBackTo" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dictation_userId_createdAt_idx" ON "Dictation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Dictation_userId_intent_state_idx" ON "Dictation"("userId", "intent", "state");

-- CreateIndex
CREATE INDEX "Dictation_destination_state_idx" ON "Dictation"("destination", "state");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_userId_endpoint_createdAt_idx" ON "IdempotencyKey"("userId", "endpoint", "createdAt");

-- CreateIndex
CREATE INDEX "AiCall_userId_createdAt_idx" ON "AiCall"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCall_callerApp_createdAt_idx" ON "AiCall"("callerApp", "createdAt");
