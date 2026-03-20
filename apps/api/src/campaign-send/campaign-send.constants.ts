export const CAMPAIGN_SEND_QUEUE_NAME = 'campaign-send';

/** Nest DI token for BullMQ Queue instance */
export const CAMPAIGN_SEND_QUEUE_TOKEN = 'CAMPAIGN_SEND_QUEUE';

/** Job name: worker runs {@link CampaignSendExecutor.processJob} */
export const CAMPAIGN_DISPATCH_JOB_NAME = 'dispatch';

/** Job name: worker enqueues dispatch at scheduled time */
export const CAMPAIGN_SCHEDULED_START_JOB_NAME = 'scheduled-start';

export function campaignDispatchJobId(campaignId: string): string {
  return `campaign-send-${campaignId}`;
}

export function campaignScheduleJobId(campaignId: string): string {
  return `campaign-schedule-${campaignId}`;
}
