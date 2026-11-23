-- CreateTable
CREATE TABLE "AskCache" (
    "key" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskCache_pkey" PRIMARY KEY ("key")
);
