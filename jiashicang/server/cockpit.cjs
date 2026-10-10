'use strict';
const { statistics } = require('./statistics.cjs');

// Read-only projections of the operational database. No seed or synthetic telemetry.
const parse = (value, fallback = {}) => { try { return typeof value === 'string' ? JSON.parse(value) : value ?? fallback; } catch { return fallback; } };
const endpoint = value => typeof value === 'string' ? value : value?.address || value?.name || '';
const initialized = snapshot => snapshot.sourceSystem === 'BUSINESS_INITIALIZATION' || snapshot.provenance?.sourceSystem === 'BUSINESS_INITIALIZATION';
const scope = user => ({ isTestData: false, ...(user.businessEntity.type === 'PLATFORM' ? {} : { OR: [{ traderId: user.businessEntityId }, { carrierId: user.businessEntityId }] }) });
const own = user => ({ isTestData: false, ...(user.businessEntity.type === 'PLATFORM' ? {} : { businessEntityId: user.businessEntityId }) });
const validPoint = point => Number.isFinite(point?.lng) && Number.isFinite(point?.lat) && point.lng >= 73 && point.lng <= 136 && point.lat >= 3 && point.lat <= 54;
const snapshotSelect = { id: true, businessNo: true, traderId: true, carrierId: true, quantityKg: true, totalCents: true, status: true, snapshot: true, createdAt: true };

function describeBusiness(b) {
 const s = parse(b.package.snapshot);
 const segments = parse(b.segments, []);
 const planned = s.plan?.segments || [];
 const nodes = segments.flatMap((seg, i) => {
  const p = planned.find(v => v.mode === seg.mode && endpoint(v.origin) === seg.origin && endpoint(v.destination) === seg.destination) || planned[i];
  return ['origin', 'destination'].flatMap(key => {
   const v = p?.[key];
   return validPoint(v) && [v.name, v.address, v.city].includes(seg[key]) ? [{ name: seg[key], lng: v.lng, lat: v.lat, mode: seg.mode, source: v.source || '业务登记' }] : [];
  });
 });
 const uniqueNodes = [...new Map(nodes.map(n => [n.name, n])).values()];
 return { id: b.id, businessNo: b.businessNo, waybillNo: b.waybillNo || b.businessNo, contractNo: b.package.businessNo, grain: s.grain || '粮食', quantityKg: b.package.quantityKg, totalCents: b.package.totalCents, status: b.status, origin: endpoint(s.origin), destination: endpoint(s.destination), trader: s.trader?.name || '', carrier: s.carrier?.name || '', nodes: uniqueNodes, segments:segments.map(v=>({mode:v.mode,origin:v.origin,destination:v.destination})), modes: [...new Set(segments.map(v => v.mode))], createdAt: b.createdAt, referenceData: initialized(s), stageCount: b.stages.length, completedStages: b.stages.filter(v => v.status === 'COMPLETED').length };
}

const group = (rows, key, amount = () => 1) => [...rows.reduce((map, row) => { const name = key(row); map.set(name, (map.get(name) || 0) + amount(row)); return map; }, new Map())].map(([name, value]) => ({ name, value }));

async function overview(db, user, query = {}) {
 const can = permission => user.permissions.includes(permission);
 const visible = can('tracking:read') || can('service:read');
 const days = query.period === 'all' ? null : Number(query.period || 30);
 const time = days ? { createdAt: { gte: new Date(Date.now() - days * 86400000) } } : {};
 const cs = scope(user), os = own(user);
 const [demands, supplies, contracts, businesses, bills] = await Promise.all([
  can('demand:read') ? db.transportDemand.findMany({ where: { ...os, ...time, deletedAt: null }, select: { id: true, businessNo: true, name: true, cargoName: true, grain: { select: { label: true } }, quantityKg: true, matchedKg: true, status: true, matchStage: true, createdAt: true } }) : [],
  can('supply:read') ? db.transportSupply.findMany({ where: { ...os, ...time, deletedAt: null, status: 'PUBLISHED' }, select: { id: true, businessEntityId: true, mode: { select: { code: true, label: true } }, capacityKg: true, validUntil: true } }) : [],
  can('contract:read') ? db.contractPackage.findMany({ where: { ...cs, ...time }, select: snapshotSelect }) : [],
  visible ? db.logisticsBusiness.findMany({ where: { ...time, package: cs }, orderBy: { createdAt: 'desc' }, select: { id: true, businessNo: true, waybillNo: true, status: true, segments: true, createdAt: true, package: { select: snapshotSelect }, stages: { select: { id: true, status: true, mode: true } } } }) : [],
  can('billing:read') ? db.bill.findMany({ where: { ...cs, ...time }, select: { id: true, businessNo: true, businessId: true, status: true, totalCents: true, createdAt: true, settlement: { select: { settledCents: true, confirmedCents: true } } } }) : []
 ]);
 const availableGrains = [...new Set([...demands.map(d => d.grain?.label || d.cargoName), ...contracts.map(c => parse(c.snapshot).grain), ...businesses.map(b => parse(b.package.snapshot).grain)].filter(Boolean))].sort();
 const matchGrain = grain => !query.grain || grain === query.grain;
 const narrowed=!!(query.origin||query.destination||query.combination||query.node||query.region);
 const bs = businesses.filter(b => {const snap=parse(b.package.snapshot),segments=parse(b.segments,[]),modes=segments.map(s=>s.mode),combo=['ROAD','RAIL','WATER'].filter(m=>modes.includes(m)).map(m=>({ROAD:'公',RAIL:'铁',WATER:'水'}[m])).join('');return matchGrain(snap.grain)&&(!query.origin||endpoint(snap.origin)===query.origin)&&(!query.destination||endpoint(snap.destination)===query.destination)&&(!query.combination||combo===query.combination)&&(!query.node||segments.some(s=>s.origin===query.node||s.destination===query.node))&&(!query.region||(snap.plan?.segments||[]).some(s=>[s.origin?.province,s.destination?.province].includes(query.region)));});
 const packageIds=new Set(bs.map(b=>b.package.id)),demandRefs=new Set(bs.flatMap(b=>{const s=parse(b.package.snapshot);return [s.demandId,s.demandNo,s.demand?.id,s.demand?.businessNo].filter(Boolean);}));
 const ds = demands.filter(d => matchGrain(d.grain?.label || d.cargoName)&&(!narrowed||demandRefs.has(d.id)||demandRefs.has(d.businessNo)));
 const csRows = contracts.filter(c => matchGrain(parse(c.snapshot).grain)&&(!narrowed||packageIds.has(c.id)));
 const businessIds = bs.map(b => b.id);
 const billRows = bills.filter(b => (!query.grain&&!narrowed)||businessIds.includes(b.businessId));
 const carrierIds=new Set(csRows.map(c=>c.carrierId));
 const supplyRows=narrowed?supplies.filter(s=>carrierIds.has(s.businessEntityId)):supplies;
 const tasks = can('tracking:read') && businessIds.length ? await db.transportTask.findMany({ where: { businessId: { in: businessIds }, status: { not: 'CANCELLED' } }, select: { id: true, businessId: true, status: true, mode: true, vehicleId: true } }) : [];
 const risks = can('tracking:read') && tasks.length ? await db.riskRecord.findMany({ where: { taskId: { in: tasks.filter(t => t.status !== 'COMPLETED').map(t => t.id) }, status: { in: ['NEW', 'ONGOING'] } }, orderBy: { lastSeenAt: 'desc' }, select: { id: true, taskId: true, type: true, level: true, message: true, lastSeenAt: true } }) : [];
 const rows = bs.map(describeBusiness);
 const totalKg = rows.reduce((sum, b) => sum + b.quantityKg, 0);
 const entityIds = new Set(csRows.flatMap(c => [c.traderId, c.carrierId]));
 const modeRows = group(rows.flatMap(b => b.modes), mode => mode);
 const daily = group(rows, b => new Date(b.createdAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }), b => b.quantityKg).sort((a, b) => a.name.localeCompare(b.name));
 const demandGroups = group(ds, d => d.status === 'PUBLISHED' && d.matchedKg < d.quantityKg ? '待匹配' : d.status === 'DRAFT' ? '待完善' : d.matchedKg >= d.quantityKg ? '已匹配' : '流转中');
 const permission = { demand: can('demand:read'), supply: can('supply:read'), contract: can('contract:read'), tracking: can('tracking:read'), service: visible, billing: can('billing:read') };
 return {
  asOf: new Date().toISOString(), scope: user.businessEntity.type === 'PLATFORM' ? '平台全局' : '本企业', permissions: permission, grains: availableGrains,
  metrics: { demandCount: permission.demand ? ds.length : null, activeCount: visible ? rows.filter(b => b.status === 'IN_PROGRESS').length : null, transportedKg: visible ? totalKg : null, completedKg: visible ? rows.filter(b => b.status === 'COMPLETED').reduce((s, b) => s + b.quantityKg, 0) : null, riskCount: permission.tracking ? risks.length : null },
  demandGroups, demands: ds.filter(d => ['DRAFT', 'PUBLISHED'].includes(d.status)).slice(0, 3).map(d => ({ id: d.id, no: d.businessNo, name: d.name, quantityKg: d.quantityKg, status: d.status })),
  grainVolumes: group(rows, b => b.grain, b => b.quantityKg).sort((a, b) => b.value - a.value), trend: daily.slice(-10),
  resources: { partners: entityIds.size, activeVehicles: new Set(tasks.filter(t => t.mode === 'ROAD' && t.status !== 'COMPLETED').map(t => t.vehicleId || t.id)).size, supplies: supplyRows.filter(s => !s.validUntil || new Date(s.validUntil) >= new Date()).length, modes: modeRows },
  contractGroups: group(csRows, c => c.status), contracts: csRows.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3).map(c => ({ id: c.id, no: c.businessNo, status: c.status, quantityKg: c.quantityKg })),
  risks: risks.slice(0, 4).map(r => ({ ...r, businessId: tasks.find(t => t.id === r.taskId)?.businessId })),
  finance: permission.billing ? { billCount: billRows.length, totalCents: billRows.reduce((s, b) => s + b.totalCents, 0), settledCents: billRows.reduce((s, b) => s + (b.settlement?.settledCents || 0), 0), outstandingCents: billRows.reduce((s, b) => s + Math.max(0, (b.settlement?.confirmedCents || 0) - (b.settlement?.settledCents || 0)), 0), groups: group(billRows, b => b.status) } : null,
  businesses: rows,
  statistics: statistics({ rows, demands: ds, bills: billRows, risks, contracts: csRows, supplies:supplyRows }),
  provenance: { addedRecords: 0, initializedBusinesses: rows.filter(b => b.referenceData).length, note: '业务指标来自当前数据库；待核验记录保留原始来源。地图线路使用独立地理参考网络，路线回放不代表已发生的运输轨迹。' }
 };
}

async function chain(db, user, id, corridorProgress) {
 const b = await db.logisticsBusiness.findFirst({ where: { id, package: scope(user) }, include: {
  package: { select: snapshotSelect },
  stages: { orderBy: { sequence: 'asc' }, include: {
   attachments: { select: { id: true, name: true, category: true, createdAt: true } },
   tasks: { where: { status: { not: 'CANCELLED' } }, include: {
    evidence: { select: { id: true, name: true, category: true, createdAt: true } },
    trackPoints: { where: { isTestData: false }, orderBy: { observedAt: 'desc' }, take: 400 },
    observations: { where: { isTestData: false }, orderBy: { observedAt: 'desc' }, take: 12 },
    issues: { where: { status: 'OPEN' }, select: { id: true, type: true, description: true } }
   } }
  } }, batches: true
 } });
 if (!b) return null;
 const snap = parse(b.package.snapshot), tasks = b.stages.flatMap(s => s.tasks), taskIds = tasks.map(t => t.id);
 const geometryIds = (snap.plan?.segments || []).map(s => s.geometryId || s.geometry?.id).filter(Boolean);
 const [geometries, risks, forecasts, bills, vehicles] = await Promise.all([
  geometryIds.length ? db.routeGeometry.findMany({ where: { id: { in: geometryIds } } }) : [],
  taskIds.length ? db.riskRecord.findMany({ where: { taskId: { in: taskIds }, status: { in: ['NEW', 'ONGOING'] } }, orderBy: { lastSeenAt: 'desc' }, take: 5 }) : [],
  taskIds.length ? db.forecast.findMany({ where: { taskId: { in: taskIds } }, orderBy: { predictedAt: 'desc' }, take: tasks.length * 2 }) : [],
  user.permissions.includes('billing:read') ? db.bill.findMany({ where: { businessId: id, ...scope(user) }, select: { id: true, businessNo: true, totalCents: true, status: true, settlement: { select: { settledCents: true, status: true } } } }) : [],
  db.fleetVehicle.findMany({ where: { id: { in: tasks.map(t => t.vehicleId).filter(Boolean) }, carrierId: b.package.carrierId }, select: { id: true, plate: true, capacityKg: true } })
 ]);
 const segments = parse(b.segments, []).map((s, i) => {
  const p = (snap.plan?.segments || []).find(v => v.mode === s.mode && endpoint(v.origin) === s.origin && endpoint(v.destination) === s.destination) || snap.plan?.segments?.[i];
  const candidate = geometries.find(g => g.id === (p?.geometryId || p?.geometry?.id)) || p?.geometry;
  const coordinates = parse(candidate?.coordinates, []);
  // A schematic link cannot become a saved transport route.
  const usable = candidate?.mode === s.mode && !/SIMULAT|PREVIEW|SYNTHETIC/i.test(candidate.source || '') && Array.isArray(coordinates) && coordinates.length >= 3;
  const node = key => validPoint(p?.[key]) && [p[key].name, p[key].address, p[key].city].includes(s[key]) ? { name: s[key], lng: p[key].lng, lat: p[key].lat } : { name: s[key] };
  return { sequence: i + 1, mode: s.mode, origin: node('origin'), destination: node('destination'), geometry: usable ? { source: candidate.source, coordinates: coordinates.filter(c => validPoint({ lng: c[0], lat: c[1] })) } : null };
 });
 const progress = corridorProgress(b.stages.map(s => ({ ...s, tasks: s.tasks.map(t => ({ ...t, evidence: t.evidence.map(e => ({ ...e, ...(initialized(snap) ? { sourceSystem: 'BUSINESS_INITIALIZATION' } : {}) })), vehicleCapacityKg: vehicles.find(v => v.id === t.vehicleId)?.capacityKg })) })), b.package.quantityKg);
 const assets = tasks.map(t => {
  const stage = b.stages.find(s => s.id === t.stageId), vehicle = vehicles.find(v => v.id === t.vehicleId);
  const points = t.trackPoints.filter(p => !/SIMULAT|PREVIEW|SYNTHETIC/i.test(p.dataQuality || '')).reverse();
  const last = points.at(-1), f = forecasts.find(f => f.taskId === t.id);
  return { id: t.id, taskNo: t.businessNo, mode: t.mode, status: t.status, title: vehicle?.plate || (t.mode === 'WATER' ? stage?.vessel : t.mode === 'RAIL' ? stage?.railWaybillNo : '') || t.resource, position: last ? { lng: last.longitude, lat: last.latitude, observedAt: last.observedAt, source: last.sourceSystem, dataQuality: last.dataQuality } : null, trajectory: points.map(p => ({ lng: p.longitude, lat: p.latitude, at: p.observedAt, source: p.sourceSystem, assetId: p.assetId })), feedbackAt: t.feedbackSubmittedAt, plannedStartAt: t.plannedStartAt || stage?.plannedStartAt, plannedEndAt: t.plannedEndAt || stage?.plannedEndAt, issues: t.issues, eta: f ? { ...parse(f.result), predictedAt: f.predictedAt } : null };
 });
 const documents = b.stages.flatMap(s => [...s.attachments.map(e => ({ ...e, stage: s.sequence, mode: s.mode })), ...s.tasks.flatMap(t => t.evidence.map(e => ({ ...e, taskNo: t.businessNo, stage: s.sequence, mode: s.mode }))) ]);
 return { ...describeBusiness(b), loadingType: snap.loadingType, contractStatus: b.package.status, demandNo: snap.demandNo || null, tradeNo: snap.tradeNo || snap.orderNo || null, quantityKg: b.package.quantityKg, segments, progress, assets, risks: risks.map(r => ({ id: r.id, message: r.message, level: r.level, at: r.lastSeenAt })), documents, bills, batches: b.batches.map(v => ({ id: v.id, name: v.name, quantityKg: v.quantityKg, boxCount: parse(v.boxes, []).length })), stages: b.stages.map(s => ({ id: s.id, sequence: s.sequence, mode: s.mode, origin: s.origin, destination: s.destination, status: s.status, plannedStartAt: s.plannedStartAt, plannedEndAt: s.plannedEndAt, completedAt: s.completedAt, vessel: s.vessel, voyage: s.voyage, railWaybillNo: s.railWaybillNo, taskCount: s.tasks.length })), asOf: new Date().toISOString() };
}

// A fixed, read-only display projection. This does not create an account or change any account permissions.
const displayContext = {businessEntity:{type:'PLATFORM'},permissions:['demand:read','supply:read','contract:read','tracking:read','service:read','billing:read']};
const publicOverview = (db,query) => overview(db,displayContext,query);
const publicChain = (db,id,progress) => chain(db,displayContext,id,progress);
module.exports = { publicOverview, publicChain, validPoint };
