// Focused source-service checks; no API restart, build, signatures or transactions created.
require('dotenv').config({ quiet: true });
require('reflect-metadata');
const fs = require('node:fs');
const { strict: assert } = require('node:assert');
const { createHash } = require('node:crypto');
const ts = require('typescript');
const { PrismaClient } = require('@prisma/client');
require.extensions['.ts'] = (module, filename) => {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true, emitDecoratorMetadata: false, esModuleInterop: true } });
  module._compile(compiled.outputText, filename);
};
const { ContractsService } = require('../apps/api/src/contracts.service.ts');
const { INDEXES, main: runInitializer } = require('../tools/initialize-contract-processes.cjs');
const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const PREFIX = 'business-init-v1-';
const SOURCE = 'BUSINESS_INITIALIZATION';
const db = new PrismaClient();
const proof = { checkedAt: new Date().toISOString(), checks: [], sourceSystem: SOURCE };
async function main() {
  const service = new ContractsService(db, { write: async () => undefined });
  const identities = {};
  for (const username of ['admin', 'trader', 'trader.b', 'carrier', 'carrier.b']) identities[username] = { user: await db.user.findUniqueOrThrow({ where: { username }, include: { businessEntity: true } }) };
  const q = { page: 1, pageSize: 100, stage: 'performance' };
  const selected = await db.contractPackage.findMany({ where: { id: { in: INDEXES.map(i => PREFIX + 'contract-' + i) } }, include: { revisions: { include: { signatures: true } } } });
  for (const [username, req] of Object.entries(identities)) {
    const expected = selected.filter(p => req.user.businessEntity.type === 'PLATFORM' || [p.traderId, p.carrierId].includes(req.user.businessEntityId));
    const workspace = await service.workspace(q, req);
    const rows = workspace.items.filter(p => p.id.startsWith(PREFIX));
    assert.equal(rows.length, expected.length);
    assert.ok(rows.every(p => p.readOnly && p.status === 'DRAFT' && p.performanceReference));
    const pending = await service.workspace({ ...q, stage: 'archives', tab: 'PENDING' }, req);
    const archived = await service.workspace({ ...q, stage: 'archives', tab: 'ARCHIVED' }, req);
    const completed = expected.filter(p => Number(p.id.split('-').at(-1)) >= 13).length;
    assert.equal(archived.items.filter(p => p.id.startsWith(PREFIX)).length, completed);
    assert.equal(pending.items.filter(p => p.id.startsWith(PREFIX)).length, expected.length - completed);
    assert.ok(archived.items.every(p => !p.archiveRecord?.snapshot));
    for (const row of archived.items.filter(p => p.id.startsWith(PREFIX))) {
      const detail = await service.detail(row.id, req);
      assert.equal(detail.archiveRecord.entityId, req.user.businessEntityId);
      assert.equal(detail.archiveRecord.referenceOnly, true);
      assert.equal(detail.archiveRecord.verification, 'UNVERIFIED_BUSINESS_RECORD');
    }
    proof.checks.push({ name: '企业合同和独立档案范围', username, performance: rows.length, pendingArchives: expected.length - completed, archived: completed });
  }
  const unrelated = { user: { ...identities.admin.user, businessEntityId: PREFIX + 'trader-huai', businessEntity: { type: 'TRADER' } } };
  assert.equal((await service.workspace(q, unrelated)).total, 0);
  await assert.rejects(service.detail(PREFIX + 'contract-13', identities['trader.b']), e => e.getStatus() === 404);
  proof.checks.push({ name: '无关企业与对方合同越权查看被阻断', passed: true });

  let plans = 0, receipts = 0, fees = 0, changes = 0, documents = 0, measurements = 0;
  const statuses = {};
  for (const p of selected) {
    const detail = await service.detail(p.id, identities.admin);
    const reference = detail.performanceReference;
    assert.equal(detail.finance.records.length, 0);
    assert.equal(detail.finance.settledCents, 0);
    assert.equal(detail.progress.canArchive, false);
    assert.equal(detail.status, 'DRAFT');
    assert.equal(detail.signing.enabled, false);
    assert.ok(detail.revisions.every(r => r.signatures.length === 0));
    assert.equal(reference.paymentPlans.reduce((n, x) => n + x.amountCents, 0), p.totalCents);
    assert.equal(reference.receiptPlans.reduce((n, x) => n + x.amountCents, 0), p.totalCents);
    assert.ok(reference.paymentPlans.every(x => x.paidCents === 0 && x.referenceOnly));
    assert.ok(reference.receiptPlans.every(x => x.receivedCents === 0 && x.referenceOnly));
    assert.equal(reference.feePlans.filter(x => x.source === 'CONTRACT').reduce((n, x) => n + x.amountCents, 0), p.totalCents);
    assert.ok(reference.paperwork.every(x => x.fileId === null && x.status === 'AWAITING_UPLOAD'));
    assert.ok(detail.measurements.every(x => x.verification === 'PENDING_VERIFICATION'));
    plans += reference.paymentPlans.length; receipts += reference.receiptPlans.length; fees += reference.feePlans.length;
    changes += reference.changes.length; documents += reference.paperwork.length; measurements += detail.measurements.length;
    statuses[detail.progress.performanceStatus] = (statuses[detail.progress.performanceStatus] || 0) + 1;
  }
  assert.equal(plans, 30); assert.equal(receipts, 30); assert.equal(fees, 36); assert.equal(changes, 4); assert.equal(documents, 80);
  assert.ok(measurements > 0);
  assert.deepEqual(statuses, { WAITING: 2, IN_PROGRESS: 4, COMPLETED: 4 });
  proof.coverage = { contracts: selected.length, paymentPlans: plans, receiptPlans: receipts, feePlans: fees, changeProposals: changes, requiredDocuments: documents, measurementReturns: measurements, statuses, actualPayments: 0, signatures: 0 };

  const target = await service.detail(PREFIX + 'contract-13', identities.trader);
  const version = target.version;
  const terms = { version, kind: 'CHANGE', reason: '核对运输安排', settlement: '核验后结算', requirements: '保存原始单据', platformFeeCents: 0, expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() };
  for (const action of [() => service.action(target.id, 'submit', { version }, identities.trader), () => service.edit(target.id, terms, identities.trader), () => service.change(target.id, terms, identities.trader), () => service.fileArchive(target.id, { version, directoryNo: 'HT-2026', dossierNo: target.businessNo, classification: 'MULTIMODAL', name: '运输合同档案', retention: '10_YEARS', archiveDate: new Date().toISOString() }, identities.trader)]) await assert.rejects(action(), e => e.getStatus() === 409);
  await assert.rejects(service.action(target.id, 'sign', { version }, identities.trader), e => e.getStatus() === 503);
  assert.equal((await service.detail(target.id, identities.trader)).version, version);
  assert.doesNotThrow(() => service.writable({ snapshot: JSON.stringify({ grain: '玉米', trader: { id: 'real-trader' } }), status: 'DRAFT' }));
  const ordinaryDraft = { id: 'ordinary-draft', status: 'DRAFT', createdAt: new Date(), snapshot: JSON.stringify({ grain: '玉米' }), revisions: [], business: null, quantityKg: 1000, traderId: 'trader-a', carrierId: 'carrier-a' };
  const isolated = new ContractsService({ contractPackage: { findMany: async () => [ordinaryDraft] }, bill: { findMany: async () => [] }, contractArchive: { findMany: async () => [] } }, null);
  assert.equal((await isolated.workspace(q, identities.admin)).total, 0);
  proof.checks.push({ name: '初始化只读操作阻断，普通草稿未获得履约例外', passed: true });

  const manifest = JSON.parse(fs.readFileSync('docs/acceptance/contract-process-initialization.json', 'utf8'));
  const backup = new PrismaClient({ datasources: { db: { url: 'file:' + manifest.backupPath.replace(/\\/g, '/') } } });
  try {
    const checks = [];
    for (const model of ['contractRevision', 'contractSignature', 'settlement', 'settlementRecord', 'contractTemplateFile', 'executionEvidence', 'stageAttachment', 'billEvidence']) {
      const [before, after] = await Promise.all([backup[model].findMany({ orderBy: { id: 'asc' } }), db[model].findMany({ orderBy: { id: 'asc' } })]);
      assert.equal(digest(after), digest(before));
      checks.push({ table: model, unchanged: true, rows: after.length });
    }
    const oldPackages = await backup.contractPackage.findMany({ where: { id: { in: selected.map(p => p.id) } }, orderBy: { id: 'asc' } });
    const newPackages = await db.contractPackage.findMany({ where: { id: { in: selected.map(p => p.id) } }, orderBy: { id: 'asc' } });
    for (let i = 0; i < oldPackages.length; i++) {
      const a = { ...oldPackages[i] }, b = { ...newPackages[i] }, snapshot = JSON.parse(b.snapshot);
      delete snapshot.contractManagement; b.snapshot = JSON.stringify(snapshot); b.updatedAt = a.updatedAt;
      assert.deepEqual(b, a);
    }
    const originalArchives = await backup.contractArchive.findMany({ orderBy: { id: 'asc' } });
    assert.equal(digest(await db.contractArchive.findMany({ where: { id: { in: originalArchives.map(a => a.id) } }, orderBy: { id: 'asc' } })), digest(originalArchives));
    proof.preserved = checks;
    proof.originalArchivesPreserved = originalArchives.length;
    proof.originalContractTermsAndGeometryPreserved = true;
  } finally { await backup.$disconnect(); }
  const beforeRerun = digest(await db.contractPackage.findMany({ where: { id: { in: selected.map(p => p.id) } }, orderBy: { id: 'asc' } }));
  const outputLines = [], originalLog = console.log;
  try { console.log = value => outputLines.push(value); await runInitializer(); } finally { console.log = originalLog; }
  const output = JSON.parse(outputLines.join(''));
  assert.equal(output.status, 'ALREADY_INITIALIZED');
  assert.equal(digest(await db.contractPackage.findMany({ where: { id: { in: selected.map(p => p.id) } }, orderBy: { id: 'asc' } })), beforeRerun);
  assert.equal(await db.contractArchive.count({ where: { id: { startsWith: 'business-init-v1-contract-processes-v1-archive-' } } }), 12);
  proof.idempotency = output.status;
  proof.passed = true;
  fs.writeFileSync('docs/acceptance/contract-process-verification.json', JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
