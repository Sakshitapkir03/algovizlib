-- CreateTable
CREATE TABLE "CheckResult" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "problemKey" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "input" TEXT,
    "answeredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckResult_pkey" PRIMARY KEY ("userId","id")
);

-- CreateIndex
CREATE INDEX "CheckResult_userId_answeredAt_idx" ON "CheckResult"("userId", "answeredAt");

-- AddForeignKey
ALTER TABLE "CheckResult" ADD CONSTRAINT "CheckResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
