import {
  getFirstStep,
  getNextStepAfter,
  getStepByOrder,
  sortStepsByOrder,
} from './sequence-step-plan.util';

describe('sequence-step-plan.util', () => {
  const steps = [
    { order: 3, delayMinutes: 10, id: 'c' },
    { order: 1, delayMinutes: 0, id: 'a' },
    { order: 2, delayMinutes: 5, id: 'b' },
  ];

  it('sortStepsByOrder sorts ascending', () => {
    const s = sortStepsByOrder(steps);
    expect(s.map((x) => x.order)).toEqual([1, 2, 3]);
  });

  it('getFirstStep returns lowest order', () => {
    expect(getFirstStep(steps)?.order).toBe(1);
  });

  it('getStepByOrder', () => {
    expect(getStepByOrder(steps, 2)?.id).toBe('b');
  });

  it('getNextStepAfter returns next by order', () => {
    expect(getNextStepAfter(steps, 1)?.order).toBe(2);
    expect(getNextStepAfter(steps, 3)).toBeUndefined();
  });
});
