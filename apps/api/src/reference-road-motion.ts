// Generated movement is confined to unverified initialization drafts. Provider
// observations always win, and no calculated point is written as a GPS record.
const SOURCE = 'BUSINESS_INITIALIZATION';
const read = (value: any) => { try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; } };
const meters = (a: number[], b: number[]) => {
  const r = Math.PI / 180, dy = (b[1] - a[1]) * r, dx = (b[0] - a[0]) * r;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(Math.sin(dy / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dx / 2) ** 2)));
};
const cache = new Map<string, any>();

export function referenceRoadMovement(task: any) {
  const pkg = task.business?.package, feedback = read(task.feedback), spec = feedback.referenceRoadMotion;
  if (task.mode !== 'ROAD' || task.status !== 'IN_TRANSIT' || pkg?.status !== 'DRAFT' || read(pkg.snapshot).sourceSystem !== SOURCE ||
      spec?.sourceSystem !== SOURCE || spec.quality !== 'INITIALIZATION' || spec.version !== 1 || spec.routeSource !== 'AMAP_V5_DRIVING') return null;
  if ((task.trackPoints || []).some((p: any) => p.sourceType !== 'INITIALIZATION' && p.sourceType !== 'SIMULATED')) return null;
  const key = JSON.stringify(spec);
  if (cache.has(key)) return cache.get(key);
  const path = spec.coordinates, start = Date.parse(spec.startAt), end = Date.parse(spec.endAt);
  if (!Array.isArray(path) || path.length < 3 || path.length > 6000 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start ||
      path.some((p: any) => !Array.isArray(p) || p.length !== 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || p[0] < 73 || p[0] > 136 || p[1] < 3 || p[1] > 54)) return null;
  const lengths = [0];
  for (let i = 1; i < path.length; i++) {
    const step = meters(path[i - 1], path[i]);
    if (step > 1500) return null;
    lengths.push(lengths[i - 1] + step);
  }
  const distance = lengths.at(-1)!;
  if (distance < 100 || distance / (end - start) * 3600 > 100) return null;
  const points = path.map((p: number[], i: number) => [p[0], p[1], Math.round(start + lengths[i] / distance * (end - start))]);
  const movement = { sourceSystem: SOURCE, quality: 'INITIALIZATION', routeSource: spec.routeSource, geometryId: spec.geometryId,
    routeName: spec.routeName, startAt: spec.startAt, endAt: spec.endAt, distanceMeters: Math.round(distance), points };
  if (cache.size >= 32) cache.delete(cache.keys().next().value!);
  cache.set(key, movement);
  return movement;
}

export function referenceRoadHistory(task: any, now = Date.now()) {
  const movement = referenceRoadMovement(task);
  if (!movement) return null;
  if (now < movement.points[0][2]) return [];
  const points: number[][] = movement.points, history: number[][] = [];
  for (const p of points) { if (p[2] > now) break; history.push(p); }
  const right = history.length;
  if (right < points.length && history.at(-1)![2] < now) {
    const a = points[right - 1], b = points[right], ratio = (now - a[2]) / Math.max(1, b[2] - a[2]);
    history.push([a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio, now]);
  }
  return history.map((p, i) => ({ id: `${task.id}:reference-motion:${p[2]}`, taskId: task.id, sourceSystem: SOURCE, sourceType: 'INITIALIZATION',
    sourceRecordId: `reference-motion:${i}:${p[2]}`, assetId: task.vehicleId || task.resource, dataQuality: 'INITIALIZATION', isTestData: false,
    longitude: p[0], latitude: p[1], observedAt: new Date(p[2]), originalLongitude: p[0], originalLatitude: p[1], originalCoordinateSystem: 'GCJ02' }));
}

export function referenceRoadForecast(task: any, now = Date.now()) {
  const movement = referenceRoadMovement(task);
  if (!movement) return null;
  const remaining = Math.max(0, Date.parse(movement.endAt) - now), duration = Date.parse(movement.endAt) - Date.parse(movement.startAt);
  return { quality: 'INITIALIZATION', eta: movement.endAt, predictedAt: new Date(now).toISOString(), remainingMinutes: Math.ceil(remaining / 60000),
    remainingKm: Math.round(movement.distanceMeters / 1000 * Math.min(1, remaining / duration) * 10) / 10,
    range: { from: movement.endAt, to: new Date(Date.parse(movement.endAt) + 30 * 60000).toISOString() }, needsReview: true,
    factors: ['按本车道路路径、错峰发车时间与参考行驶速度测算，实际到达以运输回传确认'],
    sources: [{ source: SOURCE, geometrySource: movement.routeSource, quality: 'INITIALIZATION', observedAt: new Date(now).toISOString() }],
    finalEtaNote: '参考到达窗口，尚未接入车辆实际北斗定位' };
}
