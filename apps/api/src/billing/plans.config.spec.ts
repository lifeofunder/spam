import { PlanKey } from '@prisma/client';
import { limitsForPlan, PLAN_LIMITS } from './plans.config';

describe('plans.config', () => {
  it('exposes higher PRO limits than FREE', () => {
    const free = PLAN_LIMITS[PlanKey.FREE];
    const pro = PLAN_LIMITS[PlanKey.PRO];
    expect(pro.maxContacts).toBeGreaterThan(free.maxContacts);
    expect(pro.maxEmailsPerMonth).toBeGreaterThan(free.maxEmailsPerMonth);
    expect(pro.maxActiveSequences).toBeGreaterThan(free.maxActiveSequences);
  });

  it('limitsForPlan returns FREE and PRO entries', () => {
    expect(limitsForPlan(PlanKey.FREE).maxContacts).toBe(500);
    expect(limitsForPlan(PlanKey.PRO).maxContacts).toBe(50_000);
  });
});
