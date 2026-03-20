export interface OrderedStep {
  order: number;
  delayMinutes: number;
}

export function sortStepsByOrder<T extends { order: number }>(steps: T[]): T[] {
  return [...steps].sort((a, b) => a.order - b.order);
}

export function getFirstStep<T extends { order: number }>(steps: T[]): T | undefined {
  const s = sortStepsByOrder(steps);
  return s[0];
}

export function getStepByOrder<T extends { order: number }>(steps: T[], order: number): T | undefined {
  return steps.find((x) => x.order === order);
}

/** Next step strictly after `currentOrder` by ascending `order`. */
export function getNextStepAfter<T extends { order: number }>(
  steps: T[],
  currentOrder: number,
): T | undefined {
  const sorted = sortStepsByOrder(steps);
  return sorted.find((x) => x.order > currentOrder);
}
