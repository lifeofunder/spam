export const SEQUENCE_DISPATCH_QUEUE_NAME = 'sequence-dispatch';

export const SEQUENCE_DISPATCH_QUEUE_TOKEN = 'SEQUENCE_DISPATCH_QUEUE';

/** Sends email for one step; may enqueue delayed `sequence-advance` for the next step. */
export const SEQUENCE_STEP_SEND_JOB_NAME = 'sequence-step-send';

/**
 * Delay bridge before the next step: when it runs, enqueues `sequence-step-send` for `nextStepOrder` with delay 0.
 */
export const SEQUENCE_ADVANCE_JOB_NAME = 'sequence-advance';

export function sequenceStepJobId(enrollmentId: string, stepOrder: number): string {
  return `sequence-step-${enrollmentId}-${stepOrder}`;
}

/** Runs after previous step; waits `delayMinutes` of the target step before firing. */
export function sequenceAdvanceJobId(enrollmentId: string, nextStepOrder: number): string {
  return `sequence-advance-${enrollmentId}-${nextStepOrder}`;
}
