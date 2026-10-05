export type TotalBudget = { minBudget?: number | null; maxBudget?: number | null };

// API and form use yuan; candidate costs use integer cents.
export function budgetBounds(input: TotalBudget) {
  for (const amount of [input.minBudget, input.maxBudget]) {
    if (amount != null && (!Number.isFinite(amount) || amount < 0 || amount > 20000000 || Math.abs(amount * 100 - Math.round(amount * 100)) > .00001)) {
      throw new RangeError('总预算须为0至20000000元，最多保留两位小数');
    }
  }
  if (input.minBudget != null && input.maxBudget != null && input.minBudget > input.maxBudget) {
    throw new RangeError('总预算下限不能大于上限');
  }
  return { min: input.minBudget == null ? null : Math.round(input.minBudget * 100), max: input.maxBudget == null ? null : Math.round(input.maxBudget * 100) };
}

export function filterByTotalBudget<T extends { costComplete: boolean; costCents: number | null }>(candidates: T[], input: TotalBudget) {
  const { min, max } = budgetBounds(input);
  if (min == null && max == null) return { candidates, excluded: 0, unknown: 0, constrained: false };
  const unknown = candidates.filter(c => !c.costComplete || c.costCents == null).length;
  const eligible = candidates.filter(c => c.costComplete && c.costCents != null && (min == null || c.costCents >= min) && (max == null || c.costCents <= max));
  return { candidates: eligible, excluded: candidates.length - eligible.length - unknown, unknown, constrained: true };
}
