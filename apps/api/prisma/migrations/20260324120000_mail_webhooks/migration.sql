-- CreateEnum
CREATE TYPE "WebhookMailEventType" AS ENUM ('DELIVERED', 'BOUNCED', 'COMPLAINED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "WebhookBounceKind" AS ENUM ('HARD', 'SOFT', 'UNKNOWN');

-- AlterTable
ALTER TABLE "MessageEvent" ADD COLUMN "smtpMessageId" TEXT,
ADD COLUMN "providerMessageId" TEXT;

-- CreateIndex
CREATE INDEX "MessageEvent_smtpMessageId_idx" ON "MessageEvent"("smtpMessageId");

-- CreateIndex
CREATE INDEX "MessageEvent_providerMessageId_idx" ON "MessageEvent"("providerMessageId");

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "providerEventId" TEXT,
    "type" "WebhookMailEventType" NOT NULL,
    "bounceKind" "WebhookBounceKind",
    "email" TEXT NOT NULL,
    "workspaceId" TEXT,
    "contactId" TEXT,
    "messageEventId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_idempotencyKey_key" ON "WebhookEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_email_idx" ON "WebhookEvent"("email");

-- CreateIndex
CREATE INDEX "WebhookEvent_workspaceId_idx" ON "WebhookEvent"("workspaceId");

-- CreateIndex
CREATE INDEX "WebhookEvent_messageEventId_idx" ON "WebhookEvent"("messageEventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_idx" ON "WebhookEvent"("provider");

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_messageEventId_fkey" FOREIGN KEY ("messageEventId") REFERENCES "MessageEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
