export type PlanObjective = 'RELIABILITY' | 'COST' | 'TIME';
type Candidate = {
  costComplete: boolean;
  costCents: number | null;
  durationSeconds: number;
  reliability: number;
  transferCount: number;
  modes?: string[];
};
const labels: Record<PlanObjective, string> = {
  RELIABILITY: '可靠性优先方案', COST: '成本优先方案', TIME: '时效优先方案',
};
const reasons: Record<PlanObjective, string> = {
  RELIABILITY: '满足运输条件的路线中可靠性评分最高；同分时优先减少衔接。',
  COST: '费用完整的可行路线中全程测算费用最低；同价时优先选择用时更短的路线。',
  TIME: '满足运输条件的路线中预计全程用时最短，包含候班、装卸和衔接时间。',
};
// Choose actual route winners. A route winning multiple objectives is shown once.
export function recommendPlans<T extends Candidate>(candidates: T[],preferIntermodal=false) {
  const intermodal=candidates.filter(c=>(c.modes?.length||0)>1);
  if(preferIntermodal&&intermodal.length)candidates=intermodal;
  const cost = (c: T) => c.costComplete && c.costCents != null ? c.costCents : Infinity;
  const rules: {objective: PlanObjective; pool: T[]; compare: (a: T, b: T) => number}[] = [
    {objective: 'RELIABILITY', pool: candidates, compare: (a, b) =>
      b.reliability - a.reliability || a.transferCount - b.transferCount ||
      a.durationSeconds - b.durationSeconds || cost(a) - cost(b)},
    {objective: 'COST', pool: candidates.filter(c => c.costComplete && c.costCents != null), compare: (a, b) =>
      cost(a) - cost(b) || a.durationSeconds - b.durationSeconds || b.reliability - a.reliability},
    {objective: 'TIME', pool: candidates, compare: (a, b) =>
      a.durationSeconds - b.durationSeconds || b.reliability - a.reliability || cost(a) - cost(b)},
  ];
  const recommendations: {candidate: T; objectives: PlanObjective[]; label: string; reasons: string[]}[] = [];
  const unavailable: {objective: PlanObjective; message: string}[] = [];
  for (const rule of rules) {
    const winner = [...rule.pool].sort(rule.compare)[0];
    if (!winner) {
      if (candidates.length) unavailable.push({objective: rule.objective, message: '现有路线费用不完整，暂不能生成成本优先方案。'});
      continue;
    }
    let recommendation = recommendations.find(r => r.candidate === winner);
    if (!recommendation) {
      recommendation = {candidate: winner, objectives: [], label: '', reasons: []};
      recommendations.push(recommendation);
    }
    recommendation.objectives.push(rule.objective);
    recommendation.reasons.push(reasons[rule.objective]);
    recommendation.label = recommendation.objectives.map(o => labels[o].replace('方案', '')).join(' / ') + '方案';
  }
  return {recommendations, unavailable};
}
