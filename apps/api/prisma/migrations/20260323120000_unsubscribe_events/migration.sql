-- CreateTable
CREATE TABLE "UnsubscribeEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'email_link',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnsubscribeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnsubscribeEvent_workspaceId_idx" ON "UnsubscribeEvent"("workspaceId");

-- CreateIndex
CREATE INDEX "UnsubscribeEvent_contactId_idx" ON "UnsubscribeEvent"("contactId");

-- AddForeignKey
ALTER TABLE "UnsubscribeEvent" ADD CONSTRAINT "UnsubscribeEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnsubscribeEvent" ADD CONSTRAINT "UnsubscribeEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
