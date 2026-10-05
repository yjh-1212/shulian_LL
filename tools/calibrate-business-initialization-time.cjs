/*
 * Move only the business-init-v1 initialization timeline once. Default: read-only.
 * --apply takes a consistent SQLite backup and commits an audited calibration.
 * Reference observations remain INITIALIZATION, never GPS / AIS evidence.
 */
const { PrismaClient } = require('@prisma/client');
const { createHash } = require('node:crypto');
const { mkdir, readFile, writeFile, rename } = require('node:fs/promises');
const { resolve } = require('node:path');
require('dotenv').config({ quiet: true });

const PREFIX = 'business-init-v1';
const SOURCE = 'BUSINESS_INITIALIZATION';
const AUDIT_ID = `${PREFIX}-time-calibration-v1`;
const MANIFEST_PATH = resolve('docs/acceptance/business-data-initialization.json');
const CALIBRATION_PATH = resolve('docs/acceptance/business-data-time-calibration.json');
const PREVIEW_PATH = resolve('docs/acceptance/business-data-time-calibration-preview.json');
const stringify = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? Number(v) : v);
const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : stringify(value)).digest('hex');
const prefix = `id GLOB '${PREFIX}-*'`;
const initializationJson = column => `json_valid("${column}") AND (json_extract("${column}", '$.provenance.sourceSystem') = '${SOURCE}' OR json_extract("${column}", '$.sourceSystem') = '${SOURCE}')`;

// Fields omitted here (updatedAt, ingestedAt, provider queries, legal signatures,
// pricing validFrom/validUntil) keep their original actual or reference timestamps.
const TABLES = [
  { name: 'BusinessEntity', scope: prefix, created: true },
  { name: 'User', scope: prefix, created: true },
  { name: 'VesselArchive', scope: prefix, created: true },
  { name: 'TradeOrder', scope: `${prefix} AND sourceSystem = '${SOURCE}'`, created: true },
  { name: 'TransportDemand', scope: `${prefix} AND sourceType = 'INITIALIZATION'`, dates: ['departureAt', 'arrivalAt'], created: true },
  { name: 'TransportSupply', scope: `${prefix} AND sourceType = 'INITIALIZATION'`, dates: ['serviceStart', 'serviceEnd', 'validFrom', 'validUntil'], created: true },
  { name: 'RoutePrice', scope: prefix, created: true },
  { name: 'MatchPublication', scope: `${prefix} AND ${initializationJson('snapshot')}`, dates: ['deadline', 'closedAt'], created: true, json: ['snapshot'] },
  { name: 'MatchRecipient', scope: `publicationId GLOB '${PREFIX}-*'`, conditionalDates: ['invitedAt'], keys: ['publicationId', 'carrierId'] },
  { name: 'MatchResponse', scope: `${prefix} AND ${initializationJson('terms')}`, created: true, json: ['terms'] },
  { name: 'NegotiationRound', scope: `responseId GLOB '${PREFIX}-*' AND ${initializationJson('terms')}`, created: true, json: ['terms'] },
  { name: 'CarrierConfirmation', scope: `${prefix} AND status = 'INITIALIZATION' AND ${initializationJson('terms')}`, dates: ['confirmedAt'], json: ['terms'] },
  { name: 'ContractPackage', scope: `${prefix} AND status = 'DRAFT' AND ${initializationJson('snapshot')}`, created: true, json: ['snapshot'] },
  { name: 'ContractRevision', scope: `${prefix} AND status = 'DRAFT' AND ${initializationJson('terms')}`, created: true, json: ['terms', 'documents'] },
  { name: 'LogisticsBusiness', scope: prefix, dates: ['completedAt'], created: true, json: ['segments'] },
  { name: 'TransportStage', scope: prefix, dates: ['plannedStartAt', 'plannedEndAt', 'actualEndAt', 'submittedAt', 'completedAt'], created: true, json: ['allocations'] },
  { name: 'TransportTask', scope: `${prefix} AND ${initializationJson('feedback')}`, dates: ['plannedStartAt', 'plannedEndAt', 'feedbackSubmittedAt'], created: true, json: ['feedback'] },
  { name: 'ExecutionEvent', scope: `${prefix} AND source = '${SOURCE}'`, created: true, json: ['payload'] },
  { name: 'TrackPoint', scope: `${prefix} AND sourceSystem = '${SOURCE}' AND sourceType = 'INITIALIZATION'`, dates: ['observedAt'], points: true },
  { name: 'TransportObservation', scope: `${prefix} AND sourceSystem = '${SOURCE}' AND sourceType = 'INITIALIZATION'`, dates: ['observedAt'], json: ['payload'] },
  { name: 'Forecast', scope: `${prefix} AND ${initializationJson('result')}`, json: ['result'], refresh: ['predictedAt'] },
  { name: 'RiskRecord', scope: prefix, refresh: ['lastSeenAt'] },
  { name: 'ServiceFee', scope: prefix, created: true },
  { name: 'Bill', scope: `${prefix} AND status = 'DRAFT' AND ${initializationJson('reference')}`, dates: ['periodFrom', 'periodTo'], created: true, json: ['reference'] },
  { name: 'BillItem', scope: `billId GLOB '${PREFIX}-*' AND sourceType = '${SOURCE}'`, dates: ['occurredAt'] },
];

const BUSINESS_DATE_KEYS = new Set(['departureAt', 'arrivalAt', 'plannedStartAt', 'plannedEndAt', 'startAt', 'endAt', 'actualEndAt', 'submittedAt', 'completedAt', 'feedbackSubmittedAt', 'confirmedAt', 'deadline', 'validUntil', 'expiresAt', 'serviceStart', 'serviceEnd', 'validFrom', 'periodFrom', 'periodTo', 'occurredAt', 'observedAt', 'eta', 'estimatedArrivalAt']);
const PRESERVED_KEYS = new Set(['queriedAt', 'verifiedAt', 'osmTimestamp', 'sourceTimestamp', 'updatedAt', 'ingestedAt', 'initializedAt', 'firstSeenAt', 'lastSeenAt', 'predictedAt']);
const PRESERVED_SUBTREES = new Set(['geometry', 'geometrySource', 'publicReference', 'referenceMetadata', 'providerMetadata', 'providerResponse']);

function shiftJson(text, deltaMs, oldMs, newMs, refreshForecast = false) {
  const value = JSON.parse(text);
  let shifted = 0, refreshed = 0;
  const unhandled = [];
  function walk(current, path = []) {
    if (Array.isArray(current)) return current.map((v, i) => walk(v, [...path, i]));
    if (!current || typeof current !== 'object') return current;
    const result = {};
    for (const [key, child] of Object.entries(current)) {
      const next = [...path, key];
      if (PRESERVED_SUBTREES.has(key)) { result[key] = child; continue; }
      if (typeof child === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(child) && Number.isFinite(Date.parse(child))) {
        const time = Date.parse(child);
        const isOwnProvenance = key === 'generatedAt' && current.sourceSystem === SOURCE;
        const isEtaWindow = ['from', 'to'].includes(key) && ['range', 'etaWindow'].includes(String(path.at(-1)));
        if (key === 'predictedAt' && refreshForecast && path.length === 0) {
          result[key] = new Date(newMs).toISOString(); refreshed++;
        } else if (BUSINESS_DATE_KEYS.has(key) || isOwnProvenance || isEtaWindow || key === 'createdAt' && time <= oldMs) {
          result[key] = new Date(time + deltaMs).toISOString(); shifted++;
        } else {
          result[key] = child;
          if (!PRESERVED_KEYS.has(key) && key !== 'createdAt' && key !== 'generatedAt') unhandled.push(next.join('.'));
        }
      } else result[key] = walk(child, next);
    }
    return result;
  }
  return { text: stringify(walk(value)), shifted, refreshed, unhandled };
}

async function atomicJson(path, value) {
  await mkdir(resolve('docs/acceptance'), { recursive: true });
  const temp = `${path}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2));
  await rename(temp, path);
}

async function backup(db) {
  const directory = resolve('.local/backups', `business-time-calibration-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await mkdir(directory, { recursive: true });
  const databasePath = resolve(directory, 'database.db');
  await db.$executeRawUnsafe(`VACUUM INTO '${databasePath.replace(/'/g, "''")}'`);
  const content = await readFile(databasePath);
  const manifest = { sourceSystem: SOURCE, auditId: AUDIT_ID, createdAt: new Date().toISOString(), databasePath, bytes: content.length, sha256: hash(content), method: 'SQLITE_VACUUM_INTO' };
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

async function inspect(db, oldMs, newMs) {
  const deltaMs = newMs - oldMs;
  const review = [];
  for (const config of TABLES) {
    const rows = await db.$queryRawUnsafe(`SELECT * FROM "${config.name}" WHERE ${config.scope}`);
    const dates = [...(config.dates || []), ...(config.conditionalDates || []), ...(config.created ? ['createdAt'] : [])];
    const counts = Object.fromEntries(dates.map(key => [key, rows.filter(r => r[key] !== null && r[key] !== undefined && (!(config.created && key === 'createdAt') && !(config.conditionalDates || []).includes(key) || Number(r[key]) <= oldMs)).length]));
    let jsonDates = 0, jsonRefreshes = 0;
    const unhandled = [];
    for (const row of rows) for (const column of config.json || []) {
      const change = shiftJson(row[column], deltaMs, oldMs, newMs, config.name === 'Forecast');
      jsonDates += change.shifted; jsonRefreshes += change.refreshed;
      unhandled.push(...change.unhandled.map(path => `${row.id}.${column}.${path}`));
    }
    if (unhandled.length) throw new Error(`Unreviewed initialization dates: ${unhandled.slice(0, 12).join(', ')}`);
    review.push({ table: config.name, rows: rows.length, shiftedDateFields: counts, jsonDates, jsonRefreshes, refreshedDateFields: Object.fromEntries((config.refresh || []).map(key => [key, rows.length])) });
  }
  const latest = await db.$queryRawUnsafe(`SELECT MAX(observedAt) AS latest, MIN(observedAt) AS earliest, COUNT(*) AS count FROM "TrackPoint" WHERE ${TABLES.find(t => t.name === 'TrackPoint').scope}`);
  return { sourceSystem: SOURCE, auditId: AUDIT_ID, oldBase: new Date(oldMs).toISOString(), newBase: new Date(newMs).toISOString(), deltaMs, deltaHours: deltaMs / 3600000, review,
    trajectoryBefore: { count: Number(latest[0].count), earliest: new Date(Number(latest[0].earliest)).toISOString(), latest: new Date(Number(latest[0].latest)).toISOString() },
    policy: { sourceType: 'INITIALIZATION', verification: 'UNVERIFIED_BUSINESS_RECORD', coordinatesUnchanged: true, preserveActualCreatedAndUpdated: true, preserveOriginalAuditHistory: true, preservePublicGeometryQueryDates: true, preservePriceValidityYears: true,
      forecastAndRiskRefresh: 'Only original initialization Forecast.predictedAt / result.predictedAt and RiskRecord.lastSeenAt are refreshed to the calibration instant.' } };
}

async function outsideDigests(tx) {
  const values = {};
  for (const config of TABLES) {
    const keys = config.keys || ['id'];
    const rows = await tx.$queryRawUnsafe(`SELECT * FROM "${config.name}" WHERE NOT (${config.scope}) ORDER BY ${keys.map(k => `"${k}"`).join(',')}`);
    values[config.name] = { rows: rows.length, sha256: hash(rows) };
  }
  for (const table of ['AuditLog', 'TransportNode', 'RouteGeometry', 'ContractSignature', 'ExecutionEvidence', 'StageAttachment', 'BillEvidence']) {
    const exists = await tx.$queryRawUnsafe('SELECT name FROM sqlite_master WHERE type = ? AND name = ?', 'table', table);
    if (!exists.length) continue;
    const rows = await tx.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY id`);
    values[table] = { rows: rows.length, sha256: hash(rows) };
  }
  return values;
}

function pointFingerprint(point, observedAt) {
  // Retain initializer fingerprint convention with the corrected observation time.
  return hash({ id: point.id, taskId: point.taskId, sourceType: point.sourceType, sourceSystem: point.sourceSystem, sourceRecordId: point.sourceRecordId, assetId: point.assetId,
    observedAt: new Date(observedAt), longitude: point.longitude, latitude: point.latitude, originalLongitude: point.originalLongitude, originalLatitude: point.originalLatitude,
    originalCoordinateSystem: point.originalCoordinateSystem, coordinateSystem: point.coordinateSystem, dataQuality: point.dataQuality, isTestData: Boolean(point.isTestData) });
}

async function apply(tx, review, snapshot) {
  const oldMs = Date.parse(review.oldBase), newMs = Date.parse(review.newBase), deltaMs = review.deltaMs;
  const outsideBefore = await outsideDigests(tx);
  const result = [];
  for (const config of TABLES) {
    const rows = await tx.$queryRawUnsafe(`SELECT * FROM "${config.name}" WHERE ${config.scope}`);
    if (config.points) {
      for (let offset = 0; offset < rows.length; offset += 1000) {
        const updates = rows.slice(offset, offset + 1000).map(p => ({ id: p.id, observedAt: Number(p.observedAt) + deltaMs, fingerprint: pointFingerprint(p, Number(p.observedAt) + deltaMs) }));
        await tx.$executeRawUnsafe(`WITH changes AS (SELECT json_extract(value, '$.id') AS id, json_extract(value, '$.observedAt') AS observedAt, json_extract(value, '$.fingerprint') AS fingerprint FROM json_each(?)) UPDATE "TrackPoint" SET observedAt = changes.observedAt, fingerprint = changes.fingerprint FROM changes WHERE "TrackPoint".id = changes.id AND "TrackPoint".id GLOB '${PREFIX}-*' AND "TrackPoint".sourceSystem = '${SOURCE}' AND "TrackPoint".sourceType = 'INITIALIZATION'`, stringify(updates));
      }
    } else {
      const clauses = [], params = [];
      for (const column of config.dates || []) { clauses.push(`"${column}" = CASE WHEN "${column}" IS NULL THEN NULL ELSE "${column}" + ? END`); params.push(deltaMs); }
      for (const column of [...(config.conditionalDates || []), ...(config.created ? ['createdAt'] : [])]) {
        clauses.push(`"${column}" = CASE WHEN "${column}" <= ? THEN "${column}" + ? ELSE "${column}" END`); params.push(oldMs, deltaMs);
      }
      for (const column of config.refresh || []) { clauses.push(`"${column}" = ?`); params.push(newMs); }
      if (clauses.length && rows.length) await tx.$executeRawUnsafe(`UPDATE "${config.name}" SET ${clauses.join(', ')} WHERE ${config.scope}`, ...params);
      for (const row of rows) {
        const updates = [], values = [];
        for (const column of config.json || []) {
          const change = shiftJson(row[column], deltaMs, oldMs, newMs, config.name === 'Forecast');
          if (!change.shifted && !change.refreshed) continue;
          updates.push(`"${column}" = ?`); values.push(change.text);
        }
        if (updates.length) {
          const keys = config.keys || ['id'];
          await tx.$executeRawUnsafe(`UPDATE "${config.name}" SET ${updates.join(', ')} WHERE ${keys.map(k => `"${k}" = ?`).join(' AND ')} AND ${config.scope}`, ...values, ...keys.map(k => row[k]));
        }
      }
    }
    result.push({ table: config.name, rows: rows.length });
  }
  const outsideAfter = await outsideDigests(tx);
  if (stringify(outsideBefore) !== stringify(outsideAfter)) throw new Error('A row outside the initialization scope changed; rolling back.');
  // All quantities, coordinates, actual ingestion times and valid pricing years
  // must be byte-for-byte identical, even inside the calibrated scope.
  const afterPoints = await tx.$queryRawUnsafe(`SELECT id, taskId, longitude, latitude, originalLongitude, originalLatitude, ingestedAt, sourceSystem, sourceType, dataQuality, assetId, isTestData FROM "TrackPoint" WHERE ${TABLES.find(t => t.name === 'TrackPoint').scope} ORDER BY id`);
  if (hash(afterPoints) !== snapshot.pointFactsHash) throw new Error('Position/source facts changed; rolling back.');
  const afterPrices = await tx.$queryRawUnsafe(`SELECT id, validFrom, validUntil, unit, rateMillis, enabled FROM "RoutePrice" WHERE ${prefix} ORDER BY id`);
  if (hash(afterPrices) !== snapshot.priceFactsHash) throw new Error('Annual pricing reference changed; rolling back.');
  const latest = await tx.$queryRawUnsafe(`SELECT MAX(observedAt) AS latest FROM "TrackPoint" WHERE ${TABLES.find(t => t.name === 'TrackPoint').scope}`);
  if (Number(latest[0].latest) !== Date.parse(review.trajectoryBefore.latest) + deltaMs) throw new Error('Latest initialization observation was not shifted uniformly; rolling back.');
  return { result, outsidePreserved: outsideAfter, latestObservedAt: new Date(Number(latest[0].latest)).toISOString(), pointFactsHash: snapshot.pointFactsHash, priceFactsHash: snapshot.priceFactsHash };
}

async function publishManifest(calibration) {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  manifest.originalProvenance ||= structuredClone(manifest.provenance);
  manifest.provenance.generatedAt = calibration.newBase;
  manifest.timeCalibration = calibration;
  await atomicJson(MANIFEST_PATH, manifest);
  await atomicJson(CALIBRATION_PATH, calibration);
}

async function main() {
  const db = new PrismaClient();
  try {
    const existing = await db.auditLog.findUnique({ where: { id: AUDIT_ID } });
    if (existing) {
      if (existing.result !== 'SUCCESS') throw new Error('Existing calibration audit has not succeeded.');
      const calibration = JSON.parse(existing.after);
      if (process.argv.includes('--apply')) await publishManifest(calibration);
      console.log(JSON.stringify({ status: 'ALREADY_CALIBRATED', auditId: AUDIT_ID, oldBase: calibration.oldBase, newBase: calibration.newBase, deltaMs: calibration.deltaMs, latestObservedAt: calibration.latestObservedAt }, null, 2));
      return;
    }
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    if (manifest.sourceSystem !== SOURCE || manifest.provenance?.sourceSystem !== SOURCE) throw new Error('Initialization manifest source mismatch.');
    const oldMs = Date.parse(manifest.provenance.generatedAt);
    const newMs = Date.now();
    if (!Number.isFinite(oldMs) || oldMs >= newMs) throw new Error('Calibration base is invalid or not earlier than the current instant.');
    const review = await inspect(db, oldMs, newMs);
    await atomicJson(PREVIEW_PATH, review);
    if (!process.argv.includes('--apply')) {
      console.log(JSON.stringify({ status: 'READ_ONLY_PREVIEW', oldBase: review.oldBase, newBase: review.newBase, deltaMs: review.deltaMs, trajectoryBefore: review.trajectoryBefore, tables: review.review.map(r => ({ table: r.table, rows: r.rows, jsonDates: r.jsonDates })) }, null, 2));
      return;
    }
    const backupInfo = await backup(db);
    const admin = await db.user.findUnique({ where: { username: 'admin' }, select: { id: true, displayName: true, businessEntityId: true } });
    if (!admin) throw new Error('Platform audit actor missing.');
    const calibration = await db.$transaction(async tx => {
      const duplicate = await tx.auditLog.findUnique({ where: { id: AUDIT_ID } });
      if (duplicate) throw new Error('Calibration already committed by another process; rerun safely.');
      const pointFacts = await tx.$queryRawUnsafe(`SELECT id, taskId, longitude, latitude, originalLongitude, originalLatitude, ingestedAt, sourceSystem, sourceType, dataQuality, assetId, isTestData FROM "TrackPoint" WHERE ${TABLES.find(t => t.name === 'TrackPoint').scope} ORDER BY id`);
      const priceFacts = await tx.$queryRawUnsafe(`SELECT id, validFrom, validUntil, unit, rateMillis, enabled FROM "RoutePrice" WHERE ${prefix} ORDER BY id`);
      const verification = await apply(tx, review, { pointFactsHash: hash(pointFacts), priceFactsHash: hash(priceFacts) });
      const record = { ...review, ...verification, calibratedAt: new Date().toISOString(), backup: backupInfo };
      await tx.auditLog.create({ data: { id: AUDIT_ID, userId: admin.id, userName: admin.displayName, role: 'platform', businessEntityId: admin.businessEntityId,
        ip: 'local', userAgent: 'business-time-calibration-tool', module: '业务初始化', objectId: PREFIX, action: '统一校准初始化业务时间线',
        before: stringify({ oldBase: review.oldBase, trajectoryBefore: review.trajectoryBefore }), after: stringify(record), result: 'SUCCESS', requestId: AUDIT_ID } });
      return record;
    }, { timeout: 180000, maxWait: 30000 });
    await publishManifest(calibration);
    console.log(JSON.stringify({ status: 'CALIBRATED', auditId: AUDIT_ID, oldBase: calibration.oldBase, newBase: calibration.newBase, deltaMs: calibration.deltaMs,
      latestObservedAt: calibration.latestObservedAt, backupPath: calibration.backup.databasePath, tables: calibration.result, sourceType: 'INITIALIZATION', verification: 'UNVERIFIED_BUSINESS_RECORD' }, null, 2));
  } finally { await db.$disconnect(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { shiftJson, TABLES };
