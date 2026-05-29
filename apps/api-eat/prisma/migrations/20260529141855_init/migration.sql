-- CreateTable
CREATE TABLE "MealItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sourceDictationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealItem_userId_status_idx" ON "MealItem"("userId", "status");

-- CreateIndex
CREATE INDEX "MealItem_userId_kind_idx" ON "MealItem"("userId", "kind");

-- CreateIndex
CREATE INDEX "MealItem_userId_createdAt_idx" ON "MealItem"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MealItem_userId_sourceDictationId_idx" ON "MealItem"("userId", "sourceDictationId");
