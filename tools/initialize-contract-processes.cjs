/* Contract process reference data only; never create payments, signatures or files. */
const { PrismaClient } = require('@prisma/client');
const { createHash } = require('node:crypto');
const { readFile, writeFile, mkdir } = require('node:fs/promises');
const { resolve } = require('node:path');
require('dotenv').config({ quiet: true });
const SOURCE = 'BUSINESS_INITIALIZATION', PREFIX = 'business-init-v1';
const INDEXES = [1, 4, 5, 8, 9, 10, 13, 14, 15, 16];
const MARKER = `${PREFIX}-contract-processes-v1`;
const DAY = 86400000, HOUR = 3600000;
const sha = v => createHash('sha256').update(typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v)).digest('hex');
const parse = value => JSON.parse(value || '{}');
const date = value => new Date(value).toISOString();
const modeLabels = { ROAD: '公路', RAIL: '铁路', WATER: '水运' };
const manifestPath = resolve('docs/acceptance/contract-process-initialization.json');

async function backup(db) {
  const dir = resolve('.local/backups', 'contract-processes-' + date(Date.now()).replace(/[:.]/g, '-'));
  await mkdir(dir, { recursive: true });
  const path = resolve(dir, 'database.db');
  await db.$executeRawUnsafe(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
  const bytes = await readFile(path);
  await writeFile(resolve(dir, 'manifest.json'), JSON.stringify({ sourceSystem: SOURCE, createdAt: date(Date.now()), bytes: bytes.length, sha256: sha(bytes), method: 'SQLITE_VACUUM_INTO' }, null, 2));
  return path;
}

function context(p, now) {
  const snapshot = parse(p.snapshot), stages = p.business.stages, tasks = p.business.tasks;
  const departure = Date.parse(snapshot.deal.departureAt), arrival = Date.parse(snapshot.deal.arrivalAt);
  const provenance = { ...snapshot.provenance, generatedAt: date(now), supplement: 'CONTRACT_PROCESS_REFERENCE_V1', verification: 'UNVERIFIED_BUSINESS_RECORD', note: '按用户授权补充的履约过程与档案资料。付款及收款仅为计划，未生成实际结算、签章或原始凭证。' };
  const node = stages.find(s => s.mode === 'ROAD') || stages[0];
  const first = Math.round(p.totalCents * .3), second = Math.round(p.totalCents * .5);
  const paymentPlans = [
    { name: '发运预付款', ratio: 30, amountCents: first, plannedAt: date(departure - 6 * HOUR), condition: '正式合同生效、发运计划及承运资源确认后申请', status: 'PLANNED' },
    { name: '节点进度款', ratio: 50, amountCents: second, plannedAt: date(Number(node.plannedEndAt) + 2 * DAY), condition: '集港或到站计量与运输节点资料核验后申请', status: 'AWAITING_DOCUMENTS' },
    { name: '验收尾款', ratio: 20, amountCents: p.totalCents - first - second, plannedAt: date(arrival + 30 * DAY), condition: '末段验收、原始回单、发票及双方对账确认后申请', status: 'AWAITING_RECONCILIATION' },
  ].map((r, i) => ({ ...r, id: `${p.id}-payment-plan-${i + 1}`, method: '银行转账（待确认）', payer: snapshot.trader.name, payee: snapshot.carrier.name, paidCents: 0, referenceOnly: true, provenance }));
  const receiptPlans = paymentPlans.map((r, i) => ({ id: `${p.id}-receipt-plan-${i + 1}`, name: r.name, amountCents: r.amountCents, plannedAt: r.plannedAt, counterparty: snapshot.trader.name, recipient: snapshot.carrier.name, status: 'AWAITING_PAYMENT', receivedCents: 0, condition: '以实际银行回单及双方核对结果登记收款', referenceOnly: true, provenance }));
  const segments = parse(p.business.segments);
  const per = Math.floor(p.totalCents / segments.length);
  const feePlans = segments.map((s, i) => ({ id: `${p.id}-fee-plan-${i + 1}`, name: modeLabels[s.mode] + '运输及节点衔接费', mode: s.mode, source: 'CONTRACT', amountCents: i === segments.length - 1 ? p.totalCents - per * i : per, status: 'PENDING_CONFIRMATION', description: `${s.origin} → ${s.destination}；合同参考金额分段整理，最终以签署条款及双方确认结果为准。`, referenceOnly: true }));
  if (segments.some(s => s.mode === 'WATER')) feePlans.push({ id: `${p.id}-fee-plan-port`, name: '港口杂项作业费', mode: 'WATER', source: 'OTHER', amountCents: Math.round(p.quantityKg / 1000 * 4.5 * 100), status: 'PENDING_CONFIRMATION', description: '进出港、移箱及作业附加费按实际作业明细核对，不计入已付款。', referenceOnly: true });
  const paperwork = [
    ['MAIN', '主合同与附加条款', '正式合同及签署证据待补充'],
    ['SIGNATURE', '合同签署证明', '尚未完成真实电子签署'],
    ['WEIGHT', '港站计量及过磅原单', '核对毛重、皮重、净重及交付数量'],
    ['ACCEPTANCE', '末段签收单', '以收货方原始签收资料为准'],
    ['INVOICE', '运输发票', '核对开票企业、合同及费用明细'],
    ['RECONCILIATION', '费用清单与对账确认', '双方确认后进入实际结算'],
    ...(snapshot.loadingType === 'CONTAINER' ? [['EIR', '设备交接单与铅封记录', '核对箱号、铅封号及交接状态']] : []),
    ...(segments.some(s => s.mode === 'WATER') ? [['BOL', '提单与港口作业单', '核对船名、航次、港口及装载记录']] : []),
    ...(segments.some(s => s.mode === 'RAIL') ? [['RAIL', '铁路运单与到站交付单', '核对铁路运单号、发站及到站']] : []),
  ].map(([type, name, description], i) => ({ id: `${p.id}-document-${i + 1}`, type, name, description, status: 'AWAITING_UPLOAD', fileId: null, verification: 'PENDING_VERIFICATION', referenceOnly: true }));
  const timeline = [{ id: `${p.id}-process-plan`, time: p.createdAt.toISOString(), title: '合同与联运计划资料整理', note: `${snapshot.grain} ${(p.quantityKg / 1000).toFixed(1)} 吨；${snapshot.origin} → ${snapshot.destination}`, kind: 'contract', referenceOnly: true }];
  for (const s of stages) {
    if (s.submittedAt) timeline.push({ id: `${s.id}-submitted`, time: s.submittedAt.toISOString(), title: modeLabels[s.mode] + '阶段信息回传', note: `${s.origin} → ${s.destination}；运输资源及原始单据待核验`, kind: 'transport', referenceOnly: true });
    if (s.completedAt) timeline.push({ id: `${s.id}-completed`, time: s.completedAt.toISOString(), title: modeLabels[s.mode] + '阶段交付资料整理', note: `${s.origin} → ${s.destination}；数量与状态为待核验过程资料`, kind: 'transport', referenceOnly: true });
  }
  const measurements = tasks.filter(t => parse(t.feedback).quantityKg > 0);
  if (measurements.length) timeline.push({ id: `${p.id}-measurement-summary`, time: date(Math.min(now, Math.max(...measurements.map(t => Number(t.feedbackSubmittedAt))))), title: '计量回传资料汇总', note: `${measurements.length} 车次的净重、箱号及计量编号已整理，原始附件待上传`, kind: 'transport', referenceOnly: true });
  const changes = [5, 9, 13, 16].some(i => p.id === `${PREFIX}-contract-${i}`) ? [{ id: `${p.id}-change-proposal`, number: 1, kind: 'CHANGE', reason: segments.some(s => s.mode === 'WATER') ? '港口作业及船期窗口协调' : '到站交付与接驳时间协调', status: 'PROPOSED', createdAt: date(Math.min(now, departure + 12 * HOUR)), before: '按原计划窗口进行节点衔接', after: '节点预留 6 小时衔接缓冲，货物数量及合同参考总价保持不变', settlement: '变更事项经双方核实并签署后执行；当前仅为协调提案', referenceOnly: true, provenance }] : [];
  for (const change of changes) timeline.push({ id: change.id, time: change.createdAt, title: '衔接调整提案', note: change.reason + '；尚未形成生效变更协议', kind: 'contract', referenceOnly: true });
  return { version: 1, provenance, referenceOnly: true, processStatus: p.business.status, paymentPlans, receiptPlans, feePlans, changes, paperwork, timeline,
    archivePreparation: { status: p.business.status === 'COMPLETED' ? 'REFERENCE_FILED' : 'PENDING', note: p.business.status === 'COMPLETED' ? '履约过程资料已整理为档案，签署、支付和原始凭证仍待核验。' : '运输过程、原始回单及费用资料按节点持续补充，满足正式归档条件后办理。' } };
}

async function main() {
  const db = new PrismaClient();
  try {
    const previous = await db.auditLog.findUnique({ where: { id: MARKER } });
    if (previous) { console.log(JSON.stringify({ status: 'ALREADY_INITIALIZED', ...parse(previous.after) }, null, 2)); return; }
    const ids = INDEXES.map(n => `${PREFIX}-contract-${n}`);
    const packages = await db.contractPackage.findMany({ where: { id: { in: ids } }, include: { revisions: true, business: { include: { stages: { orderBy: { sequence: 'asc' } }, tasks: true, serviceFees: true } } }, orderBy: { businessNo: 'asc' } });
    if (packages.length !== ids.length) throw new Error('Selected initialization contracts are missing.');
    for (const p of packages) if (parse(p.snapshot).provenance?.sourceSystem !== SOURCE || p.status !== 'DRAFT' || !p.business || parse(p.snapshot).contractManagement) throw new Error('Cannot overwrite a real, signed or previously supplemented contract: ' + p.id);
    const users = await db.user.findMany({ where: { username: { in: ['admin', 'trader', 'trader.b', 'carrier', 'carrier.b'] } }, select: { id: true, username: true, businessEntityId: true, displayName: true } });
    const admin = users.find(u => u.username === 'admin');
    const now = Date.now(), records = packages.map(p => ({ p, process: context(p, now) }));
    const summary = { sourceSystem: SOURCE, sourceType: 'INITIALIZATION', verification: 'UNVERIFIED_BUSINESS_RECORD', contracts: records.length,
      waiting: records.filter(r => r.p.business.status === 'PENDING').length, inProgress: records.filter(r => r.p.business.status === 'IN_PROGRESS').length, completed: records.filter(r => r.p.business.status === 'COMPLETED').length,
      paymentPlans: records.reduce((n, r) => n + r.process.paymentPlans.length, 0), receiptPlans: records.reduce((n, r) => n + r.process.receiptPlans.length, 0), feePlans: records.reduce((n, r) => n + r.process.feePlans.length, 0), changeProposals: records.reduce((n, r) => n + r.process.changes.length, 0), requiredDocuments: records.reduce((n, r) => n + r.process.paperwork.length, 0),
      referenceArchiveContracts: 4, referenceArchives: 12, pendingArchiveContracts: 6, actualPaymentsCreated: 0, actualReceiptsCreated: 0, signaturesCreated: 0, filesCreated: 0,
      records: records.map(({ p, process }) => ({ id: p.id, businessNo: p.businessNo, traderId: p.traderId, carrierId: p.carrierId, quantityTonnes: p.quantityKg / 1000, grain: parse(p.snapshot).grain, processStatus: process.processStatus, paymentPlans: process.paymentPlans.length, changes: process.changes.length, timelineEvents: process.timeline.length, referenceOnly: true })) };
    await mkdir(resolve('docs/acceptance'), { recursive: true });
    await writeFile(resolve('docs/acceptance/contract-process-initialization-preview.json'), JSON.stringify(summary, null, 2));
    if (!process.argv.includes('--apply')) { console.log(JSON.stringify({ status: 'READ_ONLY_PREVIEW', ...summary }, null, 2)); return; }
    if (!admin) throw new Error('Platform audit user is missing.');
    const backupPath = await backup(db);
    await db.$transaction(async tx => {
      if (await tx.auditLog.findUnique({ where: { id: MARKER } })) throw new Error('Another initialization already committed; rerun safely.');
      for (const { p, process } of records) {
        const current = await tx.contractPackage.findUniqueOrThrow({ where: { id: p.id } });
        if (current.snapshot !== p.snapshot || current.status !== 'DRAFT') throw new Error('Contract changed after review: ' + p.id);
        const snapshot = { ...parse(p.snapshot), contractManagement: process };
        await tx.contractPackage.update({ where: { id: p.id }, data: { snapshot: JSON.stringify(snapshot) } });
        await tx.auditLog.create({ data: { id: `${MARKER}-${p.id}`, userId: admin.id, userName: admin.displayName, role: 'platform', businessEntityId: admin.businessEntityId, ip: 'local', userAgent: 'contract-process-initialization', module: '合同', objectId: p.id, action: '补充待核验履约过程资料', before: JSON.stringify({ snapshotDigest: sha(p.snapshot), status: p.status }), after: JSON.stringify({ provenance: process.provenance, snapshotDigest: sha(snapshot), referenceOnly: true, payments: 'PLANS_ONLY', signatures: 'NONE' }), requestId: MARKER } });
        if (p.business.status !== 'COMPLETED') continue;
        for (const entityId of [p.traderId, p.carrierId, p.platformId]) {
          if (await tx.contractArchive.findUnique({ where: { packageId_entityId: { packageId: p.id, entityId } } })) throw new Error('An archive already exists; do not overwrite: ' + p.id);
          const actor = users.find(u => u.businessEntityId === entityId);
          if (!actor) throw new Error('Archive owner actor missing: ' + entityId);
          const archiveSnapshot = { provenance: process.provenance, referenceOnly: true, verification: 'UNVERIFIED_BUSINESS_RECORD', businessNo: p.businessNo, contractId: p.id, status: p.status, snapshot, processStatus: process.processStatus, completedAt: p.business.completedAt, archivePreparation: process.archivePreparation, note: '仅归档待核验的运输过程资料，合同尚未生效，未形成法律签署证据、实际付款或结清证明。' };
          const index = Number(p.id.split('-').at(-1));
          const revision = p.revisions.find(r => r.kind === 'ORIGINAL');
          await tx.contractArchive.create({ data: { id: `${MARKER}-archive-${index}-${entityId}`, packageId: p.id, entityId, revisionId: revision.id, digest: sha(archiveSnapshot), directoryNo: `LY-2026-${entityId === p.platformId ? 'PT' : entityId === p.traderId ? 'MY' : 'WL'}`, dossierNo: p.businessNo + '-LY', classification: 'MULTIMODAL', name: parse(p.snapshot).grain + '多式联运过程资料档案', retention: '10_YEARS', archiveDate: new Date(Math.min(now, Number(p.business.completedAt) + 6 * HOUR)), archivedBy: actor.id, snapshot: JSON.stringify(archiveSnapshot) } });
        }
      }
      const after = { ...summary, initializedAt: date(now), backupPath };
      await tx.auditLog.create({ data: { id: MARKER, userId: admin.id, userName: admin.displayName, role: 'platform', businessEntityId: admin.businessEntityId, ip: 'local', userAgent: 'contract-process-initialization', module: '合同资料初始化', objectId: PREFIX, action: '补充合同履约与档案资料', after: JSON.stringify(after), requestId: MARKER } });
    }, { timeout: 60000, maxWait: 30000 });
    await writeFile(manifestPath, JSON.stringify({ ...summary, initializedAt: date(now), backupPath }, null, 2));
    console.log(JSON.stringify({ status: 'INITIALIZED', ...summary, backupPath }, null, 2));
  } finally { await db.$disconnect(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { context, INDEXES, MARKER, main };
