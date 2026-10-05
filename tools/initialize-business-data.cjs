/*
 * Reviewable, idempotent business initialization. No documents or signatures are forged.
 * Default invocation is read-only; --apply makes a SQLite snapshot before writes.
 * Generated facts retain BUSINESS_INITIALIZATION provenance in every business chain.
 */
const { PrismaClient } = require('@prisma/client');
const { createHash, randomBytes } = require('node:crypto');
const { hash } = require('bcryptjs');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
require('dotenv').config({ quiet: true });

const SOURCE = 'BUSINESS_INITIALIZATION';
const PREFIX = 'business-init-v1';
const BASE = new Date();
const HOUR = 3600000;
const DAY = 24 * HOUR;
const json = value => JSON.stringify(value);
const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : json(value)).digest('hex');
const at = hours => new Date(BASE.getTime() + hours * HOUR);
const recordedAt = value => new Date(Math.min(BASE.getTime(), value?.getTime() ?? BASE.getTime()));
const id = (...parts) => [PREFIX, ...parts].join('-');
const no = (type, index) => `${type}202610${String(index + 1).padStart(4, '0')}`;
const provenance = {
  sourceSystem: SOURCE,
  sourceType: 'INITIALIZATION',
  version: 1,
  generatedAt: BASE.toISOString(),
  verification: 'UNVERIFIED_BUSINESS_RECORD',
  note: '按用户要求生成的业务初始化记录；企业账户、人员、车牌、航次、交易、任务、费用与状态不代表已核验的现实业务。公开港站与高德道路信息另行记录来源。原始凭证、身份及签章资料待实际业务录入。',
};

// These operating profiles are generated, not registrations of the public companies in the source notes.
const entityProfiles = [
  ['platform', '辽粮运营中心', 'PLATFORM', '辽宁省 / 沈阳市', ['210000', '210100']],
  ['trader-a', '黑龙江丰谷粮食贸易有限公司', 'TRADER', '黑龙江省 / 哈尔滨市', ['230000', '230100']],
  ['trader-b', '吉林沃禾粮食贸易有限公司', 'TRADER', '吉林省 / 长春市', ['220000', '220100']],
  [id('trader', 'huai'), '河南豫穗粮食贸易有限公司', 'TRADER', '河南省 / 郑州市', ['410000', '410100']],
  [id('trader', 'south'), '福建闽禾粮食贸易有限公司', 'TRADER', '福建省 / 泉州市', ['350000', '350500']],
  ['carrier-a', '辽宁汇粮联运有限公司', 'CARRIER', '辽宁省 / 营口市', ['210000', '210800']],
  ['carrier-b', '广东穗通物流有限公司', 'CARRIER', '广东省 / 广州市', ['440000', '440100']],
  [id('carrier', 'rail'), '吉林通穗联运有限公司', 'CARRIER', '吉林省 / 长春市', ['220000', '220100']],
  [id('carrier', 'water'), '江苏江海粮运有限公司', 'CARRIER', '江苏省 / 南通市', ['320000', '320600']],
];

const routeProfiles = {
  roadRail: { family: '公铁', nodes: ['盘锦站', '铁路货运蒲河物流基地', '广州国际港站', '广州北站'], modes: ['ROAD', 'RAIL', 'ROAD'], hours: [4, 40, 2], rate: 318.5 },
  roadWater: { family: '公水', nodes: ['公主岭站', '鲅鱼圈港', '南沙港'], modes: ['ROAD', 'WATER'], hours: [12, 168], rate: 246.8 },
  railWater: { family: '铁水', nodes: ['新香坊站', '鲅鱼圈港', '新沙港'], modes: ['RAIL', 'WATER'], hours: [36, 168], rate: 221.6 },
  roadRailWater: { family: '公铁水', nodes: ['公主岭站', '五棵树站', '鲅鱼圈港', '南沙港', '广州国际港站'], modes: ['ROAD', 'RAIL', 'WATER', 'ROAD'], hours: [6, 30, 168, 4], rate: 264.3 },
};

// Four grains, four route families, and three stages of a shipment lifecycle.
const shipments = [
  ['玉米', 680.5, 'roadRail', 'PENDING', 'BULK'],
  ['大豆', 420.8, 'roadWater', 'PENDING', 'BULK'],
  ['小麦', 1250.0, 'railWater', 'PENDING', 'CONTAINER'],
  ['稻谷', 860.2, 'roadRailWater', 'PENDING', 'CONTAINER'],
  ['玉米', 1680.5, 'roadWater', 'IN_PROGRESS', 'BULK', 'ROAD'],
  ['大豆', 920.3, 'roadRail', 'IN_PROGRESS', 'BULK', 'ROAD'],
  ['小麦', 1500.0, 'roadRailWater', 'IN_PROGRESS', 'CONTAINER', 'RAIL'],
  ['稻谷', 735.6, 'railWater', 'IN_PROGRESS', 'CONTAINER', 'RAIL'],
  ['玉米', 2400.0, 'railWater', 'IN_PROGRESS', 'BULK', 'WATER'],
  ['大豆', 510.4, 'roadRailWater', 'IN_PROGRESS', 'CONTAINER', 'WATER'],
  ['小麦', 980.7, 'roadRail', 'IN_PROGRESS', 'BULK', 'RAIL'],
  ['稻谷', 1360.2, 'roadWater', 'IN_PROGRESS', 'BULK', 'WATER'],
  ['玉米', 880.6, 'roadRailWater', 'COMPLETED', 'CONTAINER'],
  ['大豆', 760.5, 'railWater', 'COMPLETED', 'BULK'],
  ['小麦', 1800.0, 'roadWater', 'COMPLETED', 'BULK'],
  ['稻谷', 640.8, 'roadRail', 'COMPLETED', 'BULK'],
].map(([grain, tonnes, route, status, loadingType, activeMode], index) => ({
  index, grain, tonnes, quantityKg: Math.round(tonnes * 1000), route, status, loadingType, activeMode,
  traderId: index % 2 ? 'trader-b' : 'trader-a',
  carrierId: index % 2 ? 'carrier-b' : 'carrier-a',
  recipient: index % 3 === 0 ? '广州南粤粮油供应链有限公司' : index % 3 === 1 ? '东莞穗丰饲料原料有限公司' : '福建海禾粮食加工有限公司',
}));

function meters(a, b) {
  const latitude = (a[1] + b[1]) * Math.PI / 360;
  return Math.hypot((a[0] - b[0]) * Math.cos(latitude), a[1] - b[1]) * 111320;
}

// Preserve road bends within a 20 metre tolerance instead of reducing the route to city-to-city chords.
function simplifyPath(points, tolerance = 20) {
  if (points.length <= 2) return points;
  const retained = new Set([0, points.length - 1]);
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const a = points[first], b = points[last], scale = Math.cos(a[1] * Math.PI / 180);
    const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1], denominator = dx * dx + dy * dy || 1;
    let furthest = 0, selected = -1;
    for (let i = first + 1; i < last; i++) {
      const x = (points[i][0] - a[0]) * scale, y = points[i][1] - a[1];
      const projection = Math.max(0, Math.min(1, (x * dx + y * dy) / denominator));
      const deviation = Math.hypot(x - projection * dx, y - projection * dy) * 111320;
      if (deviation > furthest) { furthest = deviation; selected = i; }
    }
    if (furthest > tolerance) { retained.add(selected); stack.push([first, selected], [selected, last]); }
  }
  return [...retained].sort((a, b) => a - b).map(i => points[i]);
}

function distances(path) {
  const cumulative = [0];
  for (let i = 1; i < path.length; i++) cumulative.push(cumulative[i - 1] + meters(path[i - 1], path[i]));
  return cumulative;
}

function pathUntil(path, ratio) {
  const cumulative = distances(path), target = cumulative.at(-1) * ratio;
  const result = [path[0]];
  for (let i = 1; i < path.length; i++) {
    if (cumulative[i] <= target) result.push(path[i]);
    else {
      const r = (target - cumulative[i - 1]) / Math.max(1, cumulative[i] - cumulative[i - 1]);
      result.push([path[i - 1][0] + (path[i][0] - path[i - 1][0]) * r, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * r]);
      break;
    }
  }
  return result;
}

function pointOf(node) {
  return { name: node.name, nodeId: node.id, lng: node.lng, lat: node.lat, province: node.province, city: node.city,
    district: node.district, source: node.source, coordinateSystem: node.coordinateSystem || 'GCJ02' };
}

function regionOf(point) {
  const areas = require('china-area-data');
  const province = Object.entries(areas['86']).find(([, name]) => name === point.province)?.[0];
  const city = province && Object.entries(areas[province] || {}).find(([, name]) => name === point.city)?.[0];
  const district = city && Object.entries(areas[city] || {}).find(([, name]) => name === point.district)?.[0];
  if (!province || !city) throw Error('港站行政区划无法匹配正式区域字典：' + point.name);
  return { codes: [province, city, ...(district ? [district] : [])].join('/'), region: [point.province, point.city].join(' / ') };
}

async function context(db) {
  const [nodes, geometries, dictionaries, users] = await Promise.all([
    db.transportNode.findMany({ where: { enabled: true, source: { not: 'DEVELOPMENT_SCENARIO' } } }),
    db.routeGeometry.findMany({ where: { mode: 'ROAD', source: 'AMAP_V5_DRIVING' }, orderBy: { queriedAt: 'desc' } }),
    db.dictionary.findMany({ where: { enabled: true } }),
    db.user.findMany({ where: { username: { in: ['admin', 'trader', 'trader.b', 'trader.staff', 'carrier', 'carrier.b', 'carrier.staff', 'driver'] } }, select: { id: true, username: true, businessEntityId: true } }),
  ]);
  const byName = name => nodes.find(n => n.name === name);
  const nodeNames = new Set(Object.values(routeProfiles).flatMap(r => r.nodes));
  for (const name of nodeNames) {
    if (!byName(name)) throw Error('缺少公开港站资料：' + name);
    regionOf(byName(name));
  }
  for (const name of ['玉米', '大豆', '小麦', '稻谷']) if (!dictionaries.some(d => d.group === '粮食品种' && d.label === name)) throw Error('缺少粮食品种：' + name);
  for (const username of ['admin', 'trader', 'trader.b', 'carrier', 'carrier.b']) if (!users.some(u => u.username === username)) throw Error('初始化需要保留现有账号：' + username);
  const cached = geometries.map(g => ({ ...g, path: JSON.parse(g.coordinates) }));
  const findRoad = (origin, destination) => cached.find(g => g.path.length >= 3 && meters(g.path[0], [origin.lng, origin.lat]) < 350 && meters(g.path.at(-1), [destination.lng, destination.lat]) < 350);
  let external = {};
  try { external = JSON.parse(await readFile(resolve('tools/fixtures/business-route-geometries.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const routes = {};
  const pendingGeometry = [];
  for (const [key, route] of Object.entries(routeProfiles)) {
    routes[key] = route.modes.map((mode, index) => {
      const origin = byName(route.nodes[index]), destination = byName(route.nodes[index + 1]);
      const key = [mode, origin.name, destination.name].join('|');
      const road = mode === 'ROAD' ? findRoad(origin, destination) : null;
      const provided = external.routes?.[key] || external[key];
      if (provided && (!provided.source || !provided.quality || !Array.isArray(provided.coordinates) || provided.coordinates.length < 3)) throw Error('几何资料必须包括source、quality与完整coordinates：' + key);
      if (provided && (meters(provided.coordinates[0], [origin.lng, origin.lat]) > 1000 || meters(provided.coordinates.at(-1), [destination.lng, destination.lat]) > 1000)) throw Error('几何资料与港站端点不匹配：' + key);
      if (mode === 'ROAD' && !road && !provided) throw Error('缺少真实高德道路缓存，禁止退化为直线：' + key);
      const geometry = road ? { id: road.id, mode, source: road.source, quality: 'PROVIDER_REFERENCE', coordinates: road.path,
        routeProfile: road.routeProfile, distanceMeters: road.distanceMeters, durationSeconds: road.durationSeconds, queriedAt: road.queriedAt,
        sourceRef: road.sourceRef, sourceUrl: 'https://lbs.amap.com/api/webservice/guide/api/newroute' } : provided ? { ...provided, mode } : null;
      if (!geometry && !pendingGeometry.some(p => p.key === key)) pendingGeometry.push({ key, mode, origin: pointOf(origin), destination: pointOf(destination), state: 'AWAITING_VERIFIED_GEOMETRY' });
      return { sequence: index + 1, mode, origin: pointOf(origin), destination: pointOf(destination), geometry,
        geometryId: road?.id || null, durationSeconds: route.hours[index] * 3600, source: geometry?.source || 'PUBLIC_NODE_REFERENCE',
        routeProfile: geometry?.routeProfile || 'NODES_ONLY' };
    });
  }
  return { nodes, dictionaries, users, routes, pendingGeometry };
}

async function backup(db) {
  const directory = resolve('.local/backups/business-initialization-' + new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(directory, { recursive: true });
  const file = resolve(directory, 'database.db');
  await db.$executeRawUnsafe("VACUUM INTO '" + file.replace(/'/g, "''") + "'");
  const bytes = await readFile(file);
  const manifest = { createdAt: new Date(), format: 'sqlite-vacuum-snapshot', bytes: bytes.length, sha256: digest(bytes),
    sourceSystem: SOURCE, note: '一致性数据库备份，保留全部历史业务、账号、凭证；环境密钥不包含在清单中。' };
  await writeFile(resolve(directory, 'manifest.json'), json(manifest));
  return directory;
}

const keptEntityIds = ['platform', 'trader-a', 'trader-b', 'carrier-a', 'carrier-b'];
const keptProductCodes = ['GDS-CAPACITY', 'GDS-CORRIDOR', 'GDS-TRACE', 'GDS-CREDIT', 'GDS-RISK'];
const preservedDisplayNames = {
  admin: '平台管理员', trader: '企业业务员', 'trader.b': '企业业务员', 'trader.staff': '粮食业务员',
  carrier: '企业调度员', 'carrier.b': '企业调度员', 'carrier.staff': '运输调度员', driver: '张志国',
};
const oldDisplayNames = new Set(['平台管理员', '贸易商 A', '贸易商 B', '承运商 A', '承运商 B', '粮贸负责人', '粮贸 B 负责人',
  '粮贸业务员', '物流负责人', '物流 B 负责人', '物流调度员', '司机张师傅']);

// Only explicit test flags and narrow, known acceptance-fixture identities are included.
async function auditKnownTests(db) {
  const [entities, products, vessels, prices, users, templates] = await Promise.all([
    db.businessEntity.findMany({ where: { id: { notIn: keptEntityIds }, OR: [{ isTestData: true },
      { organizationId: 'sample-group', name: { startsWith: '验收粮贸企业-' } }] }, select: { id: true, name: true, organizationId: true, isTestData: true, status: true, deletedAt: true } }),
    db.dataProduct.findMany({ select: { id: true, code: true, name: true, source: true, status: true } }),
    db.vesselArchive.findMany({ select: { id: true, name: true, voyage: true, carrierId: true, enabled: true } }),
    db.routePrice.findMany({ where: { isTestData: true }, select: { id: true, source: true, enabled: true } }),
    db.user.findMany({ where: { businessEntityId: { in: keptEntityIds } }, select: { id: true, username: true, displayName: true, isTestData: true } }),
    db.contractTemplate.findMany({ select: { id: true, name: true, type: true, mode: true, status: true, fileId: true } }),
  ]);
  const candidates = products.filter(p => !keptProductCodes.includes(p.code) && (
    /^p8-\d+$/.test(p.code) && /^Phase8 指标产品(?:新版)?$/.test(p.name) ||
    /^browser-\d+$/.test(p.code) && p.name === '浏览器验收指标目录' ||
    /^(?:demo|dev|test)(?:[-_:]|$)/i.test(p.code) && /模拟|演示|样例|验收|开发|DEMO|TEST/i.test(p.name + ' ' + p.source)
  ));
  return { auditedAt: new Date(), sourceSystem: SOURCE,
    entities: entities.map(e => ({ ...e, reason: e.isTestData ? 'EXPLICIT_TEST_FLAG' : 'KNOWN_ACCEPTANCE_FIXTURE_NAME_AND_ORG' })),
    products: candidates.map(p => ({ ...p, reason: 'KNOWN_ACCEPTANCE_FIXTURE_CODE_AND_NAME' })),
    vessels: vessels.filter(v => /^tracking-demo-/.test(v.id) || v.name.includes('（模拟）') ||
      keptEntityIds.includes(v.carrierId) && /^自动验收船/.test(v.name) && /^(DEMO|TEST)/.test(v.voyage))
      .map(v => ({ ...v, reason: 'KNOWN_TRACKING_OR_ACCEPTANCE_FIXTURE' })),
    prices: prices.map(p => ({ ...p, reason: 'EXPLICIT_TEST_FLAG' })),
    templates: templates.filter(t => /模拟|演示|验收/.test(t.name) || /^simulation-(main|addendum)-/.test(t.id))
      .map(t => ({ ...t, reason: 'KNOWN_CONTRACT_TEMPLATE_FIXTURE', proposedAction: 'SOFT_ARCHIVE' })),
    preservedUsers: users.filter(u => preservedDisplayNames[u.username] && (u.isTestData || oldDisplayNames.has(u.displayName)))
      .map(u => ({ ...u, proposedDisplayName: preservedDisplayNames[u.username], reason: 'PRESERVED_EXISTING_ACCOUNT' })),
    preservedProductCodes: keptProductCodes, note: '仅列出明确测试或已知验收初始化记录；没有查验或更改任何未知真实记录。预览不写数据库。' };
}

async function auditChange(tx, ctx, kind, objectId, before, after, action = 'BUSINESS_INITIALIZATION') {
  const admin = ctx.users.find(u => u.username === 'admin');
  await tx.auditLog.upsert({ where: { id: id('audit', kind, objectId) }, update: {}, create: {
    id: id('audit', kind, objectId), userId: admin.id, userName: '平台管理员', role: 'platform_admin', businessEntityId: 'platform',
    ip: '', userAgent: 'initialize-business-data.cjs', module: '业务资料初始化', objectId, action,
    before: before == null ? null : json(before), after: json({ ...after, provenance }), requestId: id('request'),
  } });
}

async function archiveKnownTests(tx, ctx) {
  const archiveDate = new Date();
  const evidence = await auditKnownTests(tx);
  const fixtureEntities = evidence.entities.map(e => e.id);
  const knownDemand = { OR: [{ isTestData: true }, { businessEntityId: { in: fixtureEntities } }] };
  const knownSupply = { OR: [{ isTestData: true }, { businessEntityId: { in: fixtureEntities } }] };
  const knownPackage = { OR: [{ isTestData: true }, { traderId: { in: fixtureEntities } }, { carrierId: { in: fixtureEntities } }] };
  const testDemands = await tx.transportDemand.findMany({ where: knownDemand, select: { id: true } });
  const demandIds = testDemands.map(d => d.id);
  const counts = {};
  counts.publications = (await tx.matchPublication.updateMany({ where: { demandId: { in: demandIds }, status: 'ACTIVE' }, data: { status: 'CLOSED', closedAt: archiveDate } })).count;
  counts.demands = (await tx.transportDemand.updateMany({ where: { ...knownDemand, deletedAt: null }, data: { status: 'ARCHIVED', deletedAt: archiveDate } })).count;
  counts.supplies = (await tx.transportSupply.updateMany({ where: { ...knownSupply, deletedAt: null }, data: { status: 'ARCHIVED', deletedAt: archiveDate } })).count;
  counts.orders = (await tx.tradeOrder.updateMany({ where: { OR: [{ isTestData: true }, { businessEntityId: { in: fixtureEntities } }], status: 'ACTIVE' }, data: { status: 'ARCHIVED' } })).count;
  counts.plans = (await tx.planRun.updateMany({ where: { OR: [{ isTestData: true }, { businessEntityId: { in: fixtureEntities } }], status: { not: 'ARCHIVED' } }, data: { status: 'ARCHIVED' } })).count;
  counts.packages = (await tx.contractPackage.updateMany({ where: { ...knownPackage, status: { not: 'TERMINATED' } }, data: { status: 'TERMINATED' } })).count;
  counts.bills = (await tx.bill.updateMany({ where: { OR: [{ isTestData: true }, { traderId: { in: fixtureEntities } }, { carrierId: { in: fixtureEntities } }], archivedAt: null }, data: { archivedAt: archiveDate } })).count;
  // Preserve all original account IDs and passwords used by the owner, including the driver.
  counts.entities = (await tx.businessEntity.updateMany({ where: { id: { in: fixtureEntities }, deletedAt: null }, data: { status: 'INACTIVE', deletedAt: archiveDate } })).count;
  counts.users = (await tx.user.updateMany({ where: { businessEntityId: { in: fixtureEntities }, username: { notIn: Object.keys(preservedDisplayNames) }, deletedAt: null }, data: { status: 'INACTIVE', deletedAt: archiveDate } })).count;
  counts.vessels = (await tx.vesselArchive.updateMany({ where: { id: { in: evidence.vessels.map(v => v.id) }, enabled: true }, data: { enabled: false } })).count;
  counts.products = (await tx.dataProduct.updateMany({ where: { id: { in: evidence.products.map(p => p.id) }, status: { not: 'OFFLINE' } }, data: { status: 'OFFLINE' } })).count;
  counts.templates = (await tx.contractTemplate.updateMany({ where: { id: { in: evidence.templates.map(t => t.id) }, status: { not: 'ARCHIVED' } }, data: { status: 'ARCHIVED' } })).count;
  counts.prices = (await tx.routePrice.updateMany({ where: { id: { in: evidence.prices.map(p => p.id) }, enabled: true }, data: { enabled: false } })).count;
  counts.monitoringSignals = (await tx.monitoringSignal.updateMany({ where: { isTestData: true }, data: { validTo: new Date('2000-01-01') } })).count;
  for (const entity of evidence.entities.filter(e => !e.deletedAt)) await auditChange(tx, ctx, 'archive-entity', entity.id,
    { name: entity.name, status: entity.status, isTestData: entity.isTestData }, { status: 'INACTIVE', deletedAt: archiveDate, evidence: entity.reason }, 'SOFT_ARCHIVE_KNOWN_FIXTURE');
  for (const product of evidence.products.filter(p => p.status !== 'OFFLINE')) await auditChange(tx, ctx, 'archive-product', product.id,
    { name: product.name, code: product.code, status: product.status }, { status: 'OFFLINE', evidence: product.reason }, 'SOFT_ARCHIVE_KNOWN_FIXTURE');
  for (const vessel of evidence.vessels.filter(v => v.enabled)) await auditChange(tx, ctx, 'archive-vessel', vessel.id,
    { name: vessel.name, voyage: vessel.voyage, enabled: true }, { enabled: false, evidence: vessel.reason }, 'SOFT_ARCHIVE_KNOWN_FIXTURE');
  for (const template of evidence.templates.filter(t => t.status !== 'ARCHIVED')) await auditChange(tx, ctx, 'archive-template', template.id,
    { name: template.name, status: template.status, fileId: template.fileId }, { status: 'ARCHIVED', evidence: template.reason }, 'SOFT_ARCHIVE_KNOWN_FIXTURE');
  return { ...counts, evidence };
}

async function profiles(tx, ctx) {
  const org = await tx.organization.upsert({ where: { id: id('organization') }, update: {}, create: { id: id('organization'), name: '粮食联运业务体系' } });
  for (const [entityId, name, type, registeredRegion, registeredCodes] of entityProfiles) {
    const old = await tx.businessEntity.findUnique({ where: { id: entityId } });
    if (old && !old.isTestData && old.name !== name) throw Error('主体已有非测试资料，禁止覆盖：' + entityId);
    const data = { name, type, registeredRegion, registeredCodes: registeredCodes.join('/'), isTestData: false, status: 'ACTIVE', deletedAt: null, phone: '', contact: type === 'PLATFORM' ? '运营管理部' : '业务调度部' };
    if (old?.isTestData) {
      await tx.businessEntity.update({ where: { id: entityId }, data });
      await auditChange(tx, ctx, 'entity', entityId, { name: old.name, type: old.type, isTestData: old.isTestData }, data);
    } else if (!old) {
      await tx.businessEntity.create({ data: { ...data, id: entityId, organizationId: org.id, createdAt: BASE } });
      await auditChange(tx, ctx, 'entity', entityId, null, data);
    }
  }
  const preservedUsers = await tx.user.findMany({ where: { businessEntityId: { in: keptEntityIds }, username: { in: Object.keys(preservedDisplayNames) } } });
  for (const user of preservedUsers) {
    const displayName = preservedDisplayNames[user.username] && (user.isTestData || oldDisplayNames.has(user.displayName)) ? preservedDisplayNames[user.username] : user.displayName;
    const data = { isTestData: false, displayName, ...(user.username === 'driver' && user.isTestData ? { phone: '' } : {}) };
    if (user.isTestData || displayName !== user.displayName) {
      await tx.user.update({ where: { id: user.id }, data });
      await auditChange(tx, ctx, 'user', user.id, { displayName: user.displayName, isTestData: user.isTestData }, data);
    }
  }
  const names = ['王立军', '李建国', '刘成林', '赵海峰', '周长生', '孙志强', '陈文斌', '郑庆华', '马建平', '于振江', '梁家伟', '何国栋'];
  const drivers = {};
  for (const carrierId of ['carrier-a', 'carrier-b']) {
    drivers[carrierId] = [];
    if (carrierId === 'carrier-a') {
      const current = ctx.users.find(u => u.username === 'driver');
      if (current) drivers[carrierId].push(current.id);
    }
    for (let i = 0; i < 6; i++) {
      const username = `transport.driver.${carrierId.endsWith('a') ? 'ln' : 'gd'}.${i + 1}`;
      let current = await tx.user.findUnique({ where: { username } });
      if (!current) {
        current = await tx.user.create({ data: { id: id('driver', carrierId, i + 1), username,
          displayName: names[i + (carrierId === 'carrier-a' ? 0 : 6)], businessEntityId: carrierId,
          passwordHash: await hash(randomBytes(32).toString('base64url'), 12), mustChangePassword: true, isTestData: false,
          roles: { create: { role: { connect: { code: 'driver' } } } }, phone: '', email: '', department: '运输车队', createdAt: BASE } });
        await auditChange(tx, ctx, 'driver', current.id, null, { username, displayName: current.displayName, businessEntityId: carrierId, isTestData: false });
      }
      drivers[carrierId].push(current.id);
    }
  }
  const vehicles = {};
  for (const carrierId of ['carrier-a', 'carrier-b']) {
    vehicles[carrierId] = [];
    for (let i = 0; i < 8; i++) {
      // Valid looking generated resource references, never validated vehicle registrations.
      const plate = (carrierId === 'carrier-a' ? '辽B' : '粤A') + ['8F', '7G', '6H', '5J'][i % 4] + String(261 + i * 13);
      const old = await tx.fleetVehicle.findUnique({ where: { carrierId_plate: { carrierId, plate } } });
      const vehicle = old || await tx.fleetVehicle.create({ data: { id: id('vehicle', carrierId, i + 1), carrierId, plate, capacityKg: 32000 } });
      vehicles[carrierId].push(vehicle);
      if (!old) await auditChange(tx, ctx, 'vehicle', vehicle.id, null, { plate, carrierId, capacityKg: 32000, registrationStatus: 'AWAITING_VERIFICATION' });
    }
  }
  const vessels = {};
  for (const carrierId of ['carrier-a', 'carrier-b']) {
    vessels[carrierId] = [];
    for (let i = 0; i < 2; i++) {
      const name = carrierId === 'carrier-a' ? ['辽运丰泽', '北航嘉禾'][i] : ['穗运兴粮', '江海丰禾'][i];
      const voyage = '2610' + String(i + 1).padStart(2, '0');
      const old = await tx.vesselArchive.findUnique({ where: { carrierId_name_voyage: { carrierId, name, voyage } } });
      const vessel = old || await tx.vesselArchive.create({ data: { id: id('vessel', carrierId, i + 1), carrierId, name, voyage, mmsi: '', enabled: true, createdAt: BASE } });
      vessels[carrierId].push(vessel);
      if (!old) await auditChange(tx, ctx, 'vessel', vessel.id, null, { name, voyage, carrierId, mmsi: '', registrationStatus: 'AWAITING_VERIFICATION' });
    }
  }
  return { drivers, vehicles, vessels };
}

function userFor(ctx, entityId, role) {
  return ctx.users.find(u => u.businessEntityId === entityId && (role === 'trader' ? ['trader', 'trader.b'] : ['carrier', 'carrier.b']).includes(u.username))?.id || ctx.users.find(u => u.username === 'admin').id;
}

function trackPath(coordinates, ratio, seconds) {
  const sparse = pathUntil(simplifyPath(coordinates), ratio);
  const sparseDistance = distances(sparse).at(-1) || 1;
  seconds = Math.max(1, seconds);
  const maximumGap = Math.min(1500, Math.max(100, sparseDistance / seconds * 240));
  const route = [sparse[0]];
  for (let i = 1; i < sparse.length; i++) {
    const a = sparse[i - 1], b = sparse[i], count = Math.ceil(meters(a, b) / maximumGap);
    for (let n = 1; n <= count; n++) route.push([a[0] + (b[0] - a[0]) * n / count, a[1] + (b[1] - a[1]) * n / count]);
  }
  if (route.length > 5000) throw Error('初始化跟踪超过5000点，须重新审核几何简化参数，禁止截断路线：' + route.length);
  return route;
}

async function addTrack(tx, task, segment, ratio, start, end) {
  if (!segment.geometry || ratio <= 0) return 0;
  const route = trackPath(segment.geometry.coordinates, ratio, (end.getTime() - start.getTime()) / 1000);
  const cumulative = distances(route), total = cumulative.at(-1) || 1;
  const records = route.map((coords, index) => {
    const time = new Date(start.getTime() + (end.getTime() - start.getTime()) * cumulative[index] / total);
    const point = { id: id('point', task.id, index), taskId: task.id, sourceType: 'INITIALIZATION', sourceSystem: SOURCE,
      sourceRecordId: task.id + ':' + index, assetId: task.vehicleId || task.resource, observedAt: time,
      longitude: coords[0], latitude: coords[1], originalLongitude: coords[0], originalLatitude: coords[1],
      originalCoordinateSystem: 'GCJ02', coordinateSystem: 'GCJ02', dataQuality: 'INITIALIZATION', isTestData: false };
    return { ...point, fingerprint: digest(point) };
  });
  await tx.trackPoint.createMany({ data: records });
  return records.length;
}

function contractText(shipment, route, traderName, carrierName, totalCents) {
  return `${shipment.grain}多式联运运输合同（草案）\n合同编号：${no('HT', shipment.index)}\n委托方：${traderName}\n承运方：${carrierName}\n运输路线：${route.map(s => s.origin.name).concat(route.at(-1).destination.name).join(' → ')}\n运输方式：${routeProfiles[shipment.route].family}联运\n货物数量：${shipment.tonnes.toFixed(1)}吨\n装载形式：${shipment.loadingType === 'CONTAINER' ? '集装箱' : '散货'}\n参考运输金额：${(totalCents / 100).toFixed(2)}元\n交付数量以合规计量和双方确认的签收资料为准，承运方负责阶段衔接、粮食品质保护与过程回传。\n结算约定：收齐运输单据并经双方核对确认后，按实际签署约定结算。\n其他费用须提供名称、业务说明和实际费用凭证，并经双方确认。\n合同状态：草拟，尚未签署生效。\n本记录为用户授权的业务初始化数据，实际企业、人员、车辆身份及交易真实性尚未核验；不存在签章或已上传的法律凭证。`;
}

async function shipment(tx, ctx, resources, s) {
  const businessId = id('waybill', s.index + 1);
  if (await tx.logisticsBusiness.findUnique({ where: { id: businessId } })) return { id: businessId, skipped: true };
  const route = ctx.routes[s.route];
  const profile = routeProfiles[s.route];
  const traderUser = userFor(ctx, s.traderId, 'trader'), carrierUser = userFor(ctx, s.carrierId, 'carrier');
  const trader = entityProfiles.find(p => p[0] === s.traderId), carrier = entityProfiles.find(p => p[0] === s.carrierId);
  const origin = route[0].origin, destination = route.at(-1).destination;
  const originRegion = regionOf(origin), destinationRegion = regionOf(destination);
  const grain = ctx.dictionaries.find(d => d.group === '粮食品种' && d.label === s.grain);
  const dictionaries = ctx.dictionaries.filter(d => d.group === '运输方式');
  const modeLabels = { ROAD: '公路', RAIL: '铁路', WATER: '水运' };
  const totalCents = Math.round(s.tonnes * profile.rate * 100);
  const roadLoads = [];
  for (let remaining = s.quantityKg, trip = 0; remaining > 0; trip++) {
    const netKg = Math.min(remaining, 28500 + (trip % 4) * 500);
    roadLoads.push(netKg); remaining -= netKg;
  }
  const stageDurations = route.map(segment => {
    if (segment.mode !== 'ROAD') return segment.durationSeconds;
    const rounds = Math.ceil(roadLoads.length / 8);
    return segment.durationSeconds * Math.max(1, rounds * 2 - 1) + (rounds - 1) * 7200 + 5400;
  });
  const totalDuration = stageDurations.reduce((n, seconds) => n + seconds * 1000 + 4 * HOUR, 0);
  const activeRouteIndex = s.status === 'IN_PROGRESS' ? route.findIndex(p => p.mode === s.activeMode) : -1;
  const elapsedBeforeActive = activeRouteIndex < 0 ? 0 : stageDurations.slice(0, activeRouteIndex).reduce((n, seconds) => n + seconds * 1000 + 4 * HOUR, 0);
  const departureAt = s.status === 'PENDING' ? at(48 + s.index * 4) : s.status === 'COMPLETED' ? new Date(BASE.getTime() - totalDuration - (48 + s.index * 2) * HOUR)
    : new Date(BASE.getTime() - elapsedBeforeActive - route[activeRouteIndex].durationSeconds * 1000 * .6);
  const arrivalAt = new Date(departureAt.getTime() + totalDuration);
  const tradeOrder = await tx.tradeOrder.create({ data: { id: id('trade', s.index + 1), businessNo: no('JY', s.index), businessEntityId: s.traderId,
    recipient: s.recipient, shipperContact: '粮食业务部', shipperPhone: '', recipientContact: '收货作业部', recipientPhone: '',
    sourceSystem: SOURCE, sourceRecordId: id('trade', s.index + 1), sourceDigest: digest({ ...s, provenance }), sourceType: 'INITIALIZATION', isTestData: false,
    createdAt: new Date(departureAt.getTime() - 7 * DAY), items: { create: { id: id('item', s.index + 1), lineNo: '1', grainId: grain.id, cargoName: s.grain,
      specification: s.grain === '玉米' ? '二等黄玉米，水分≤14.0%' : s.grain === '大豆' ? '食用大豆，水分≤13.0%' : s.grain === '小麦' ? '普通小麦，水分≤12.5%' : '粳稻谷，水分≤14.5%',
      grainGrade: '二等', pickupAddress: origin.name, pickupCodes: originRegion.codes, quantityKg: s.quantityKg, reservedKg: s.quantityKg } } } });
  const demand = await tx.transportDemand.create({ data: { id: id('demand', s.index + 1), businessNo: no('XQ', s.index), name: `${origin.city}至${destination.city}${s.grain}运输`,
    businessEntityId: s.traderId, orderItemId: id('item', s.index + 1), grainId: grain.id, cargoName: s.grain, quantityKg: s.quantityKg,
    originCodes: originRegion.codes, originRegion: originRegion.region, originAddress: origin.name,
    destinationCodes: destinationRegion.codes, destinationRegion: destinationRegion.region, destinationAddress: destination.name,
    departureAt, arrivalAt, allowMultimodal: true, allowTransfer: true, maxTransfers: 4, loadingType: s.loadingType, preference: ['COST', 'TIME', 'BALANCED'][s.index % 3],
    budgetCents: Math.round(totalCents * 1.08), contact: '粮食业务部', phone: '', notes: '装卸须防潮、防混粮。交付数量以计量与签收资料为准，节点及时回传。', status: 'PUBLISHED', createdAt: recordedAt(new Date(departureAt.getTime() - 3 * DAY)),
    matchStage: s.status === 'PENDING' ? 'BIDDING' : 'MATCHED', matchedKg: s.status === 'PENDING' ? 0 : s.quantityKg,
    createdBy: traderUser, updatedBy: traderUser, sourceType: 'INITIALIZATION', isTestData: false,
    modes: { create: [...new Set(route.map(p => p.mode))].map(mode => ({ modeId: dictionaries.find(d => d.label === modeLabels[mode]).id })) } } });
  const snapshot = { ...provenance, provenance, trader: { id: s.traderId, name: trader[1], contact: '粮食业务部', phone: '' },
    carrier: { id: s.carrierId, name: carrier[1], contact: '运输调度部', phone: '' }, platform: { id: 'platform', name: '辽粮运营中心', contact: '运营管理部', phone: '' },
    confirmationNo: no('CY', s.index), demandId: demand.id, demandNo: demand.businessNo, grain: s.grain, loadingType: s.loadingType,
    origin: origin.name, destination: destination.name, quantityKg: s.quantityKg, totalCents,
    deal: { quantity: s.tonnes, quantityKg: s.quantityKg, departureAt: departureAt.toISOString(), arrivalAt: arrivalAt.toISOString(), price: profile.rate,
      priceCents: Math.round(profile.rate * 100), unit: 'PER_TON', totalCents, taxIncluded: true, followOriginalPlan: true },
    plan: { name: `${origin.city}—${destination.city}${profile.family}联运`, version: 1, segments: route }, templates: [] };
  const quoteUntil = new Date(departureAt.getTime() - DAY), deadline = new Date(departureAt.getTime() - 12 * HOUR);
  const publication = await tx.matchPublication.create({ data: { id: id('publication', s.index + 1), businessNo: no('PP', s.index), demandId: demand.id,
    mode: s.index % 2 ? 'DIRECTED' : 'PUBLIC', targetCarrierId: s.index % 2 ? s.carrierId : null, deadline, quoteType: 'PER_TON',
    budgetPublic: false, contactPublic: false, notes: '按完整联运方案提供报价，注明装卸衔接安排及附加费用。', snapshot: json({ provenance,
      name: demand.name, businessNo: demand.businessNo, grain: s.grain, cargoName: s.grain, specification: '', quantityKg: s.quantityKg,
      originRegion: demand.originRegion, originAddress: origin.name, destinationRegion: demand.destinationRegion, destinationAddress: destination.name, departureAt, arrivalAt,
      loadingType: s.loadingType, modes: route.map(p => modeLabels[p.mode]), allowTransfer: true, maxTransfers: 4, notes: demand.notes,
      plan: null, privateInfo: { contact: '', phone: '', budgetCents: demand.budgetCents } }),
    quantityKg: s.quantityKg, matchedKg: s.status === 'PENDING' ? 0 : s.quantityKg, stage: s.status === 'PENDING' ? 'BIDDING' : 'MATCHED',
    status: s.status === 'PENDING' ? 'ACTIVE' : 'CLOSED', demandVersion: 1, createdBy: traderUser, createdAt: recordedAt(new Date(departureAt.getTime() - 2 * DAY)),
    recipients: s.index % 2 ? { create: [{ carrierId: 'carrier-a', invitedBy: traderUser, invitedAt: BASE }, { carrierId: 'carrier-b', invitedBy: traderUser, invitedAt: BASE }] } : undefined } });
  const terms = { provenance, quantity: s.tonnes, quantityKg: s.quantityKg, price: profile.rate, priceCents: Math.round(profile.rate * 100), unit: 'PER_TON', totalCents,
    taxIncluded: true, followOriginalPlan: true, capability: `${profile.family}联运组织，提供粮食集疏运、港站衔接与运输单据回传。`,
    note: '车辆及船期按作业计划协调，其他费用须提供说明并经双方确认。', departureAt: departureAt.toISOString(), arrivalAt: arrivalAt.toISOString(),
    validUntil: quoteUntil.toISOString(), loadingType: s.loadingType, requirements: '防潮、防混粮、装卸减损，节点及时回传', settlement: '单据审核及双方核对后结算' };
  const response = await tx.matchResponse.create({ data: { id: id('response', s.index + 1), publicationId: publication.id, carrierId: s.carrierId,
    createdBy: carrierUser, lastAuthorId: s.carrierId, status: s.status === 'PENDING' ? 'OPEN' : 'CONFIRMED', terms: json(terms), createdAt: recordedAt(new Date(departureAt.getTime() - 36 * HOUR)),
    rounds: { create: { round: 1, action: 'OFFER', terms: json(terms), authorEntityId: s.carrierId, authorId: carrierUser, authorName: '运输调度部', note: terms.note, createdAt: recordedAt(new Date(departureAt.getTime() - 36 * HOUR)) } } } });
  await tx.carrierConfirmation.create({ data: { id: id('confirmation', s.index + 1), businessNo: no('CY', s.index), publicationId: publication.id,
    responseId: response.id, demandId: demand.id, traderId: s.traderId, carrierId: s.carrierId, quantityKg: s.quantityKg, totalCents,
    terms: json(terms), status: 'INITIALIZATION', confirmedBy: traderUser, confirmedAt: BASE } });
  const pkg = await tx.contractPackage.create({ data: { id: id('contract', s.index + 1), businessNo: no('HT', s.index), confirmationId: id('confirmation', s.index + 1),
    traderId: s.traderId, carrierId: s.carrierId, platformId: 'platform', quantityKg: s.quantityKg, totalCents, status: 'DRAFT', snapshot: json(snapshot), isTestData: false,
    createdAt: recordedAt(new Date(departureAt.getTime() - DAY)) } });
  const body = contractText(s, route, trader[1], carrier[1], totalCents);
  await tx.contractRevision.create({ data: { id: id('revision', s.index + 1), packageId: pkg.id, number: 1, kind: 'ORIGINAL', status: 'DRAFT', mode: 'A',
    terms: json({ ...terms, platformFeeCents: 0, expiresAt: at(24 * 60).toISOString() }), documents: json([
      { type: 'MAIN', name: s.grain + '多式联运运输合同', body, provenance },
      { type: 'ADDENDUM', name: '联运节点与交付条款附件', body: body + '\n运输计划、费用清单与港站接口须由双方核实，原始凭证按实际业务上传。', provenance },
    ]), digest: digest(body), createdAt: recordedAt(new Date(departureAt.getTime() - DAY)) } });
  const b = await tx.logisticsBusiness.create({ data: { id: businessId, packageId: pkg.id, businessNo: no('LY', s.index), waybillNo: no('YD', s.index), mode: 'SINGLE',
    segments: json(route.map(p => ({ mode: p.mode, origin: p.origin.name, destination: p.destination.name }))), status: s.status,
    createdAt: recordedAt(new Date(departureAt.getTime() - DAY)), completedAt: s.status === 'COMPLETED' ? arrivalAt : null } });
  const fees = [];
  let points = 0, tasks = 0;
  const activeIndex = s.status === 'IN_PROGRESS' ? route.findIndex(p => p.mode === s.activeMode) : s.status === 'COMPLETED' ? route.length : -1;
  let cursor = departureAt.getTime();
  const addFee = async (source, name, amountCents, stageId, taskId, feeCode = 'OTHER') => {
    const f = await tx.serviceFee.create({ data: { id: id('fee', s.index + 1, fees.length + 1), sourceKey: id('fee', s.index + 1, fees.length + 1),
      businessId: b.id, stageId, taskId, source, feeCode, name, amountCents, description: name + '，按实际费用凭证与双方确认结果结算。',
      selected: true, userId: carrierUser, createdAt: BASE } });
    await auditChange(tx, ctx, 'fee', f.id, null, { businessId: b.id, stageId, taskId, source, feeCode, name, amountCents });
    fees.push(f); return f;
  };
  for (const [routeIndex, segment] of route.entries()) {
    const done = s.status === 'COMPLETED' || routeIndex < activeIndex;
    const active = routeIndex === activeIndex;
    const stageStart = new Date(cursor), stageEnd = new Date(cursor + stageDurations[routeIndex] * 1000);
    cursor = stageEnd.getTime() + 4 * HOUR;
    const partitions = segment.mode === 'WATER' && s.quantityKg >= 1000000 && (done || active) ? 2 : 1;
    for (let partition = 0; partition < partitions; partition++) {
      const quantityKg = partitions === 2 ? partition ? s.quantityKg - Math.floor(s.quantityKg / 200) * 100 : Math.floor(s.quantityKg / 200) * 100 : s.quantityKg;
      const vessel = resources.vessels[s.carrierId][partition];
      const stageId = id('stage', s.index + 1, routeIndex + 1, partition + 1);
      const stage = await tx.transportStage.create({ data: { id: stageId, businessId: b.id, sequence: routeIndex * 2 + partition + 1, mode: segment.mode,
        origin: segment.origin.name, destination: segment.destination.name, quantityKg, status: done ? 'COMPLETED' : active ? 'SUBMITTED' : 'DRAFT',
        plannedStartAt: stageStart, plannedEndAt: stageEnd, containerized: s.loadingType === 'CONTAINER',
        vessel: segment.mode === 'WATER' ? vessel.name : '', voyage: segment.mode === 'WATER' ? vessel.voyage : '', vesselId: segment.mode === 'WATER' ? vessel.id : null,
        mmsi: '', billOfLading: segment.mode === 'WATER' ? no('BL', s.index) + '-' + (partition + 1) : '',
        railWaybillNo: segment.mode === 'RAIL' ? '95306' + no('', s.index) : '', notes: '做好阶段衔接及粮食品质保护，作业单据随业务回传。', createdAt: recordedAt(stageStart),
        submittedAt: done || active ? stageStart : null, completedAt: done ? stageEnd : null, actualEndAt: done ? stageEnd : null,
        completionNote: done ? '初始化履约过程；实际签收及原始附件待核验' : '' } });
      if (!done && !active) continue;
      const completedRoadCount = done ? roadLoads.length : 2;
      const taskCount = segment.mode === 'ROAD' ? done ? completedRoadCount : completedRoadCount + 4 : 1;
      let reportedKg = 0;
      const allocations = [];
      for (let taskIndex = 0; taskIndex < taskCount; taskIndex++) {
        const road = segment.mode === 'ROAD';
        const finished = done || road && taskIndex < completedRoadCount;
        const vehicle = road ? resources.vehicles[s.carrierId][taskIndex % resources.vehicles[s.carrierId].length] : null;
        const driverId = road ? resources.drivers[s.carrierId][taskIndex % resources.drivers[s.carrierId].length] : null;
        const netKg = road && finished ? roadLoads[taskIndex] : 0;
        reportedKg += netKg;
        const taskId = id('task', s.index + 1, routeIndex + 1, partition + 1, taskIndex + 1);
        const resource = road ? vehicle.plate : segment.mode === 'WATER' ? vessel.name + ' / ' + vessel.voyage : stage.railWaybillNo;
        const taskStart = road && active && finished ? new Date(BASE.getTime() - segment.durationSeconds * 1000 - 3 * HOUR - taskIndex * 20 * 60000)
          : road ? new Date(stageStart.getTime() + (taskIndex % 8) * 10 * 60000 + Math.floor(taskIndex / 8) * (segment.durationSeconds * 2000 + 2 * HOUR)) : stageStart;
        const taskEnd = new Date(taskStart.getTime() + segment.durationSeconds * 1000);
        const boxes = s.loadingType === 'CONTAINER' && finished ? [{ boxNo: 'LLGU' + String((s.index + 1) * 10000 + routeIndex * 1000 + taskIndex).padStart(7, '0'), quantityKg: netKg }] : [];
        const feedback = road && finished ? { provenance, quantityKg: netKg, grossKg: netKg + 16500, tareKg: 16500,
          weightTicketNo: no('GB', s.index) + '-' + (routeIndex + 1) + '-' + (taskIndex + 1), containers: boxes,
          receiver: segment.destination.name + '作业组', sealNo: boxes.length ? 'SF' + String(202610000 + s.index * 100 + taskIndex) : '',
          note: '初始化计量回传，原始计量、设备交接和签收附件待上传核验' } : provenance;
        const task = await tx.transportTask.create({ data: { id: taskId, businessNo: no('RW', s.index) + '-' + (routeIndex + 1) + '-' + (partition + 1) + '-' + String(taskIndex + 1).padStart(3, '0'),
          businessId: b.id, stageId, serviceManaged: true, segment: routeIndex + 1, mode: segment.mode,
          quantityKg: road ? 0 : quantityKg, vehicleId: vehicle?.id, driverId, resource, status: finished ? 'COMPLETED' : 'IN_TRANSIT',
          plannedStartAt: taskStart, plannedEndAt: taskEnd, feedback: json(feedback), feedbackSubmittedAt: road && finished ? taskEnd : null,
          loadedKg: road ? finished ? netKg : null : quantityKg, unloadedKg: finished ? road ? netKg : quantityKg : null,
          createdAt: recordedAt(taskStart) } });
        tasks++;
        if (road) allocations.push({ vehicleId: vehicle.id, driverId, plate: vehicle.plate, capacityKg: vehicle.capacityKg,
          startAt: taskStart.toISOString(), endAt: taskEnd.toISOString() });
        const ratio = finished ? 1 : road ? [.19, .37, .58, .79][(taskIndex - completedRoadCount + 4) % 4] : partition === 0 ? .38 : .57;
        const trackEnd = finished ? taskEnd : BASE;
        const trackStart = finished ? taskStart : new Date(BASE.getTime() - segment.durationSeconds * 1000 * ratio);
        points += await addTrack(tx, task, segment, ratio, trackStart, trackEnd);
        if (!finished) {
          const delayMinutes = segment.mode === 'WATER' ? 90 : segment.mode === 'RAIL' ? 45 : 30;
          const remainingMinutes = Math.ceil(segment.durationSeconds / 60 * (1 - ratio)) + delayMinutes;
          const eta = new Date(BASE.getTime() + remainingMinutes * 60000);
          await tx.forecast.create({ data: { id: id('forecast', taskId), taskId, predictedAt: new Date(), inputDigest: digest({ taskId, ratio, provenance }),
            result: json({ provenance, quality: 'INITIALIZATION', eta: eta.toISOString(), predictedAt: new Date(),
              range: { from: new Date(eta.getTime() - HOUR).toISOString(), to: new Date(eta.getTime() + 2 * HOUR).toISOString() },
              remainingMinutes, remainingKm: segment.geometry ? Math.round(segment.geometry.distanceMeters / 1000 * (1 - ratio) * 10) / 10 : null,
              needsReview: true, factors: ['按参考路线、初始化进度及节点作业时长计算，实际排程需业务核实'],
              sources: [{ source: SOURCE, geometrySource: segment.geometry?.source || 'PUBLIC_NODE_REFERENCE', observedAt: BASE, quality: 'INITIALIZATION' }],
              finalEtaNote: '参考到达窗口，须核对实际运输与作业回传' }) } });
          if (s.index === 4 && taskIndex === completedRoadCount || s.index === 8 && partition === 0) {
            const message = segment.mode === 'WATER' ? '目的港泊位计划尚待确认，预计衔接窗口需预留90分钟。' : '集港预约时段调整，进港衔接需预留30分钟，请核对预约回执。';
            const riskId = id('risk', taskId);
            await tx.riskRecord.create({ data: { id: riskId, taskId, type: segment.mode === 'WATER' ? 'PORT_CONGESTION' : 'ETA_DELAY',
              level: 'MEDIUM', message, status: 'NEW', firstSeenAt: new Date(), lastSeenAt: new Date() } });
            await auditChange(tx, ctx, 'risk', riskId, null, { taskId, level: 'MEDIUM', message, quality: 'INITIALIZATION' });
          }
        }
        await tx.executionEvent.create({ data: { id: id('event', taskId), taskId, requestKey: SOURCE, type: finished ? 'COMPLETE' : 'DEPART',
          source: SOURCE, userId: road ? driverId : carrierUser, payload: json({ provenance, actualEndAt: finished ? taskEnd : null }), createdAt: finished ? taskEnd : trackStart } });
        if (!segment.geometry && segment.mode !== 'ROAD') await tx.transportObservation.create({ data: { id: id('observation', taskId), taskId,
          sourceType: 'INITIALIZATION', sourceSystem: SOURCE, sourceRecordId: taskId + ':node', eventType: finished ? 'ARRIVAL' : 'DEPARTURE',
          nodeId: finished ? segment.destination.nodeId : segment.origin.nodeId, nodeName: finished ? segment.destination.name : segment.origin.name,
          observedAt: trackEnd, payload: json({ provenance, railWaybillNo: stage.railWaybillNo, vessel: stage.vessel }), fingerprint: digest(taskId), isTestData: false } });
      }
      if (allocations.length) await tx.transportStage.update({ where: { id: stage.id }, data: { allocations: json(allocations) } });
      await addFee('CONTRACT', segment.mode === 'ROAD' ? '公路集疏运参考费用' : segment.mode === 'WATER' ? '水运参考费用' : '铁路参考费用', Math.round(totalCents / route.length / partitions), stageId, null, 'TRANSPORT');
      if (segment.mode === 'WATER') await addFee('OTHER', '港口杂项作业费', Math.round(quantityKg / 1000 * 4.5 * 100), stageId, null, 'PORT_MISC');
    }
  }
  if (s.status === 'COMPLETED') {
    const billId = id('bill', s.index + 1), billTotal = fees.reduce((n, fee) => n + fee.amountCents, 0);
    await tx.bill.create({ data: { id: billId, businessNo: no('ZD', s.index), businessId: b.id, packageId: pkg.id,
      traderId: s.traderId, carrierId: s.carrierId, periodFrom: departureAt, periodTo: arrivalAt, status: 'DRAFT', totalCents: billTotal,
      quantityKg: s.quantityKg, reference: json({ provenance, snapshot, contractNo: pkg.businessNo, waybillNo: b.waybillNo,
        logisticsNo: b.businessNo, contractAmountCents: totalCents, plannedQuantityKg: s.quantityKg, terms, tasks: [], stages: [], fees }),
      remark: '费用草稿，按运输单据及双方确认结果核对结算。', isTestData: false, createdAt: recordedAt(arrivalAt),
      items: { create: fees.map((fee, index) => ({ sequence: index + 1, feeCode: fee.feeCode, feeName: fee.name,
        sourceType: SOURCE, sourceId: fee.id, stageId: fee.stageId, mode: 'MULTIMODAL', resource: b.waybillNo, quantityMillis: 1000, unit: '次',
        unitPriceCents: fee.amountCents, originalCents: fee.amountCents, finalCents: fee.amountCents, occurredAt: arrivalAt,
        basis: '合同约定费用与阶段作业记录，原始凭证待上传确认。' })) } } });
    await tx.serviceFee.updateMany({ where: { businessId: b.id }, data: { billId } });
  }
  return { id: b.id, waybillNo: b.waybillNo, contractId: pkg.id, contractNo: pkg.businessNo, tradeOrderId: tradeOrder.id,
    routeFamily: profile.family, quantityTonnes: s.tonnes, grain: s.grain, status: s.status, tasks, trackPoints: points,
    segments: route.map(p => ({ mode: p.mode, origin: p.origin, destination: p.destination, geometryId: p.geometryId,
      geometrySource: p.geometry?.source || null, geometryQuality: p.geometry?.quality || null })) };
}

async function supplies(tx, ctx) {
  let created = 0;
  const allGrains = ctx.dictionaries.filter(d => d.group === '粮食品种' && ['玉米', '大豆', '小麦', '稻谷'].includes(d.label));
  const multimodal = ctx.dictionaries.find(d => d.group === '运输方式' && d.label === '多式联运');
  for (const [carrierIndex, carrier] of entityProfiles.filter(p => p[2] === 'CARRIER').entries()) {
    for (const [routeIndex, [routeKey, profile]] of Object.entries(routeProfiles).entries()) {
      const supplyId = id('supply', carrierIndex + 1, routeIndex + 1);
      if (await tx.transportSupply.findUnique({ where: { id: supplyId } })) continue;
      const route = ctx.routes[routeKey], origin = route[0].origin, destination = route.at(-1).destination;
      const originRegion = regionOf(origin), destinationRegion = regionOf(destination);
      const loadingType = (carrierIndex + routeIndex) % 2 ? 'CONTAINER' : 'BULK';
      const price = Math.round((profile.rate + carrierIndex * 8.5 - routeIndex * 1.2) * 100);
      await tx.transportSupply.create({ data: { id: supplyId, businessNo: 'GY202610' + String(carrierIndex * 4 + routeIndex + 1).padStart(4, '0'),
        name: `${origin.city}—${destination.city}${profile.family}粮食联运`, businessEntityId: carrier[0], modeId: multimodal.id,
        originCodes: originRegion.codes, originRegion: originRegion.region, originAddress: origin.name,
        destinationCodes: destinationRegion.codes, destinationRegion: destinationRegion.region, destinationAddress: destination.name,
        viaNodes: route.map(s => s.origin.name).slice(1).join('、'), capacityKg: 6000000, minKg: 100000, maxKg: 5000000,
        resourceType: loadingType === 'CONTAINER' ? 'CONTAINER' : 'COMBINED', resourceDescription: `${profile.family}衔接、集港、${loadingType === 'CONTAINER' ? '集装箱作业' : '散粮装卸'}`, capabilities: '粮食运输、港站衔接、过程回传',
        serviceStart: at(-24), serviceEnd: at(24 * 90), durationHours: profile.hours.reduce((n, h) => n + h, 0),
        referencePriceCents: loadingType === 'BULK' ? price : null, priceUnit: loadingType === 'BULK' ? 'PER_TON' : null,
        bulkPriceCents: loadingType === 'BULK' ? price : null, container20PriceCents: loadingType === 'CONTAINER' ? price * 26 : null,
        container40PriceCents: loadingType === 'CONTAINER' ? price * 27 : null, loadingType, validFrom: at(-24), validUntil: at(24 * 90),
        contact: '运输调度部', phone: '', notes: '整程组织、港站交接及粮食品质保护，装卸作业与回单要求可在议价时确认。', status: 'PUBLISHED', createdBy: userFor(ctx, carrier[0], 'carrier'), createdAt: at(-24),
        updatedBy: userFor(ctx, carrier[0], 'carrier'), sourceType: 'INITIALIZATION', isTestData: false,
        grains: { create: allGrains.map(g => ({ grainId: g.id })) } } });
      await auditChange(tx, ctx, 'supply', supplyId, null, { carrierId: carrier[0], route: routeKey, loadingType, priceType: 'INITIALIZATION_REFERENCE' });
      created++;
    }
  }
  return created;
}

const roadPriceProfiles = [
  { key: 'general', grain: null, rateMillis: 360 },
  { key: 'soybean', grain: '大豆', rateMillis: 400 },
  { key: 'paddy', grain: '稻谷', rateMillis: 380 },
];
async function referencePrices(tx, ctx) {
  let created = 0;
  for (const reference of roadPriceProfiles) {
    const priceId = id('price', 'road', reference.key);
    if (await tx.routePrice.findUnique({ where: { id: priceId } })) continue;
    const data = { id: priceId, lineId: null,
      grainId: reference.grain ? ctx.dictionaries.find(d => d.group === '粮食品种' && d.label === reference.grain).id : null,
      unit: 'PER_TON_KM', rateMillis: reference.rateMillis,
      validFrom: new Date('2026-01-01T00:00:00Z'), validUntil: new Date('2028-01-01T00:00:00Z'),
      source: '公路参考估算，成交价待确认', maintainer: '辽粮运营中心', enabled: true, isTestData: false, createdAt: BASE,
    };
    await tx.routePrice.create({ data });
    await auditChange(tx, ctx, 'price', priceId, null, { ...data, grain: reference.grain, priceType: 'INITIALIZATION_ESTIMATE' });
    created++;
  }
  return created;
}

async function main() {
  const db = new PrismaClient();
  try {
    const ctx = await context(db);
    const fixtureAudit = await auditKnownTests(db);
    const trackGeometryReview = Object.fromEntries(Object.entries(ctx.routes).map(([key, segments]) => [key, segments.map(segment => ({
      mode: segment.mode, origin: segment.origin.name, destination: segment.destination.name,
      source: segment.geometry?.source || 'PUBLIC_NODE_REFERENCE', quality: segment.geometry?.quality || 'NODES_ONLY',
      rawPoints: segment.geometry?.coordinates.length || 0,
      fullTrackPoints: segment.geometry ? trackPath(segment.geometry.coordinates, 1, segment.durationSeconds).length : 0,
    }))]));
    const supplyProfileReview = entityProfiles.filter(p => p[2] === 'CARRIER').flatMap(([carrierId, name], carrierIndex) => Object.entries(routeProfiles).map(([route, profile], routeIndex) => ({
      id: id('supply', carrierIndex + 1, routeIndex + 1), carrierId, carrierName: name, route, family: profile.family,
      loadingType: (carrierIndex + routeIndex) % 2 ? 'CONTAINER' : 'BULK',
      origin: regionOf(ctx.routes[route][0].origin), destination: regionOf(ctx.routes[route].at(-1).destination),
      sourceType: 'INITIALIZATION', createdAt: at(-24),
    })));
    const preview = { sourceSystem: SOURCE, provenance, totals: { trades: 16, contractDrafts: 16, waybills: 16, grains: 4, routeFamilies: 4,
      pending: 4, inProgress: 8, completed: 4, billDrafts: 4, supplyProfiles: 16, roadReferencePrices: roadPriceProfiles.length }, entities: entityProfiles.map(([entityId, name, type, region]) => ({ id: entityId, name, type, region })),
      shipments: shipments.map(s => ({ ...s, routeLabel: routeProfiles[s.route].family, nodes: routeProfiles[s.route].nodes })), pendingGeometry: ctx.pendingGeometry,
      trackGeometryReview, supplyProfileReview, fixtureAudit, roadReferencePrices: roadPriceProfiles.map(p => ({ ...p, unit: 'PER_TON_KM', source: '公路参考估算，成交价待确认', provenance })),
      notes: ['企业、人员、车牌、船名、航次及交易均为生成初始化资料。', '未编造手机号、统一信用代码、MMSI、PDF凭证或签章。', '合同均为DRAFT，实际业务更新仍须正常生效。', '初始化的定位点来源INITIALIZATION，可查询来源，不能表示已接入北斗或AIS。'] };
    await mkdir(resolve('docs/acceptance'), { recursive: true });
    await writeFile(resolve('docs/acceptance/business-data-initialization-preview.json'), JSON.stringify(preview, null, 2));
    await writeFile(resolve('docs/acceptance/business-data-fixture-audit.json'), JSON.stringify(fixtureAudit, null, 2));
    if (!process.argv.includes('--apply')) { console.log('只读预览完成：16笔交易、16份合同草案、16个运单。未修改数据库。'); console.log('待补几何：' + ctx.pendingGeometry.length); return; }
    const backupPath = await backup(db);
    const counts = process.argv.includes('--archive-tests') ? await db.$transaction(tx => archiveKnownTests(tx, ctx), { timeout: 60000 }) : {};
    const resources = await db.$transaction(tx => profiles(tx, ctx), { timeout: 60000 });
    const referencePriceCount = await db.$transaction(tx => referencePrices(tx, ctx), { timeout: 60000 });
    const records = [];
    for (const s of shipments) records.push(await db.$transaction(tx => shipment(tx, ctx, resources, s), { timeout: 120000, maxWait: 30000 }));
    const supplyCount = await db.$transaction(tx => supplies(tx, ctx), { timeout: 60000 });
    // A repeat run creates no new timeline. Keep its original source manifest,
    // including any committed time calibration, instead of assigning today's BASE.
    if (records.every(record => record.skipped) && !supplyCount && !referencePriceCount) {
      try {
        const previous = JSON.parse(await readFile(resolve('docs/acceptance/business-data-initialization.json'), 'utf8'));
        if (previous.sourceSystem === SOURCE && previous.records?.length) {
          console.log('业务初始化已存在：未重置业务，保留原来源清单及时间校准。');
          console.log('本次一致性备份：' + backupPath);
          return;
        }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const manifest = { initializedAt: new Date(), sourceSystem: SOURCE, provenance, backupPath, archivedKnownTests: counts,
      suppliesCreated: supplyCount, referencePricesCreated: referencePriceCount, records, pendingGeometry: ctx.pendingGeometry,
      trackGeometryReview, preservedAccounts: ctx.users.map(u => ({ id: u.id, username: u.username })),
      taskProvenance: 'TransportTask.feedback / ExecutionEvent.payload', entityProvenance: 'docs/business-data-sources.md and this manifest',
      privateDataPolicy: '无电话、证件号码、印章图、法律签章或虚构原始附件；新增司机密码随机且要求首次修改，不输出密码。' };
    await writeFile(resolve('docs/acceptance/business-data-initialization.json'), JSON.stringify(manifest, null, 2));
    console.log('业务初始化完成：' + records.filter(r => !r.skipped).length + ' 个新运单，' + supplyCount + ' 条新运力。');
    console.log('一致性备份：' + backupPath);
    console.log('来源清单：docs/acceptance/business-data-initialization.json');
  } finally { await db.$disconnect(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { shipments, routeProfiles, provenance, simplifyPath, pathUntil, trackPath, meters, auditKnownTests };
