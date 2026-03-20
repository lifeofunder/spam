export interface SequenceStepSendPayload {
  enrollmentId: string;
  workspaceId: string;
  stepOrder: number;
}

export interface SequenceAdvancePayload {
  enrollmentId: string;
  workspaceId: string;
  nextStepOrder: number;
}
