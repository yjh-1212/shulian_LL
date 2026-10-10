'use strict';

// All chart series are read-only aggregates. Blank months mean no registered records.
const sum = (rows, value) => rows.reduce((total, row) => total + (Number(value(row)) || 0), 0);
const group = (rows, key, value) => [...rows.reduce((map, row) => {
 const name = key(row); map.set(name, (map.get(name) || 0) + (Number(value(row)) || 0)); return map;
}, new Map())].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
const month = date => new Date(date).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 7);
const area = address => {
 if (!address) return '未登记地区';
 // Keep the registered city, never infer a province from a trade lane.
 const match = address.match(/(?:[^省自治区]{2,7}省|内蒙古自治区|广西壮族自治区|新疆维吾尔自治区|宁夏回族自治区|西藏自治区)?([^省区县\s]{2,7}市)/);
 if (match) return match[1];
 return address.replace(/（.*?）|\(.*?\)/g, '').slice(0, 10);
};
const modeNames = { ROAD: '公路', RAIL: '铁路', WATER: '水运' };
const combination = row => ['ROAD', 'RAIL', 'WATER'].filter(mode => row.modes.includes(mode)).map(mode => modeNames[mode][0]).join('') || '待登记';
const state = row => row.status === 'COMPLETED' ? '已完成' : row.status === 'IN_PROGRESS' ? '执行中' : row.status === 'CANCELLED' ? '已取消' : '待启动';

function statistics({ rows, demands, bills, risks, contracts, supplies }) {
 const today = new Date(), months = Array.from({ length: 6 }, (_, i) => month(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5 + i, 15))));
 const volumeTrend = months.map(name => ({ name, value: sum(rows.filter(row => month(row.createdAt) === name), row => row.quantityKg) }));
 const coordinationTrend = months.map(name => {
  const records = demands.filter(row => month(row.createdAt) === name);
  return { name, first: records.length, second: records.filter(row => row.quantityKg > 0 && row.matchedKg >= row.quantityKg).length };
 });
 const financeTrend = months.map(name => {
  const records = bills.filter(row => month(row.createdAt) === name);
  return { name, first: sum(records, row => row.totalCents), second: sum(records, row => row.settlement?.settledCents), line: sum(records, row => Math.max(0, (row.settlement?.confirmedCents || 0) - (row.settlement?.settledCents || 0))) };
 });
 const modeVolumes = group(rows, combination, row => row.quantityKg);
 const origins = group(rows, row => area(row.origin), row => row.quantityKg);
 const destinations = group(rows, row => area(row.destination), row => row.quantityKg);
 const grains = [...new Set(rows.map(row => row.grain))].sort();
 const modes = modeVolumes.map(row => row.name);
 const heatmap = grains.flatMap(grain => modes.map(mode => ({ grain, mode, value: sum(rows.filter(row => row.grain === grain && combination(row) === mode), row => row.quantityKg) })));
 const links = [];
 for (const row of rows) {
  const mode = combination(row), status = state(row);
  for (const [source, target, column] of [[row.grain, mode, 0], [mode, status, 1]]) {
   let link = links.find(item => item.source === source && item.target === target && item.column === column);
   if (!link) { link = { source, target, column, value: 0 }; links.push(link); }
   link.value += row.quantityKg;
  }
 }
 const scatter = rows.filter(row => row.quantityKg > 0 && Number.isFinite(row.totalCents) && row.totalCents > 0).map(row => ({ grain: row.grain, x: row.quantityKg / 1000, y: row.totalCents / 100 / (row.quantityKg / 1000), status: state(row) }));
 const completed = rows.filter(row => row.status === 'COMPLETED').length;
 return {
  volumeTrend, coordinationTrend, financeTrend, modeVolumes, origins, destinations, heatmap, links, scatter,
  riskGroups: group(risks, row => ({ PORT_CONGESTION: '港口拥堵', ENVIRONMENT: '环境影响', ETA_DELAY: '到达时效偏差', DELAY: '运输延迟', QUANTITY: '数量异常', MISSING_EVIDENCE: '凭证待补充' }[row.type] || '节点衔接异常'), () => 1),
  fulfillment: { total: rows.length, completed, active: rows.filter(row => row.status === 'IN_PROGRESS').length, completionRate: rows.length ? completed / rows.length * 100 : null, contracts: contracts.length },
  coordination: { demands: demands.length, matched: demands.filter(row => row.quantityKg > 0 && row.matchedKg >= row.quantityKg).length, supplies: supplies.filter(row => !row.validUntil || new Date(row.validUntil) >= today).length },
  costBasis: '合同约定单价；按计划运输量计算，不代表实际结算成本',
  financeBasis: '按账单创建月份归集，已结算为该批账单当前累计金额',
  flowBasis: '粮种 → 联运方式 → 业务状态；各层运输量按业务去重',
 };
}
module.exports = { statistics, area, combination };
