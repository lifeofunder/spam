-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "scheduledAt" TIMESTAMP(3),
ADD COLUMN "scheduleJobId" TEXT;

-- CreateIndex
CREATE INDEX "Campaign_workspaceId_scheduledAt_idx" ON "Campaign"("workspaceId", "scheduledAt");
