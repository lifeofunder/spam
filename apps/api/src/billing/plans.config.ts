import { PlanKey } from '@prisma/client';

export type PlanLimits = {
  maxContacts: number;
  maxEmailsPerMonth: number;
  maxActiveSequences: number;
};

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  FREE: {
    maxContacts: 500,
    maxEmailsPerMonth: 2_000,
    maxActiveSequences: 1,
  },
  PRO: {
    maxContacts: 50_000,
    maxEmailsPerMonth: 200_000,
    maxActiveSequences: 20,
  },
};

export function limitsForPlan(planKey: PlanKey): PlanLimits {
  return PLAN_LIMITS[planKey] ?? PLAN_LIMITS.FREE;
}
