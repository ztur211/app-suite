-- CreateTable
CREATE TABLE "ShoppingItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "quantity" INTEGER,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sourceDictationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShoppingItem_userId_status_idx" ON "ShoppingItem"("userId", "status");

-- CreateIndex
CREATE INDEX "ShoppingItem_userId_createdAt_idx" ON "ShoppingItem"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ShoppingItem_userId_sourceDictationId_idx" ON "ShoppingItem"("userId", "sourceDictationId");
