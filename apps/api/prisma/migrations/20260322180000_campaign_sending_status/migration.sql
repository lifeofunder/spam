-- AlterEnum
ALTER TYPE "CampaignStatus" ADD VALUE 'SENDING';
ALTER TYPE "CampaignStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "sendJobId" TEXT;
