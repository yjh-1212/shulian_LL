const fields = ['id', 'longitude', 'latitude', 'observedAt', 'assetId', 'sourceSystem', 'sourceType', 'dataQuality', 'gapBefore'];

/** A lossless wire representation: every coordinate and observation is retained. */
export function packTrajectory(points: any[], route?: number[][]) {
  if (!points.length) return {fields: [], defaults: {}, rows: []};
  const defaults: Record<string, any> = {};
  for (const field of fields) {
    if (field === 'observedAt' || points[0][field] === undefined) continue;
    if (points.every(p => p[field] === points[0][field])) defaults[field] = points[0][field];
  }
  let idPrefix = '';
  if (points.every(p => typeof p.id === 'string')) {
    idPrefix = points[0].id;
    for (const p of points) {
      let i = 0;
      while (i < idPrefix.length && p.id[i] === idPrefix[i]) i++;
      idPrefix = idPrefix.slice(0, i);
    }
  }
  const indices = route ? new Map(route.map((p, i) => [p[2], i])) : null;
  const routePoints = route ? points.map(p => {
    const time = new Date(p.observedAt).getTime(), index = indices!.get(time);
    return index !== undefined && route[index][0] === p.longitude && route[index][1] === p.latitude
      ? index : [p.longitude, p.latitude, time];
  }) : undefined;
  const columns = fields.filter(f => !(f in defaults) && points.some(p => p[f] !== undefined) &&
    (!route || !['longitude', 'latitude', 'observedAt'].includes(f)));
  return {fields: columns, defaults, idPrefix, routePoints, rows: points.map(p => columns.map(f =>
    f === 'observedAt' ? new Date(p[f]).getTime() : f === 'id' && idPrefix ? p.id.slice(idPrefix.length) : p[f] ?? null))};
}

export function trackingPayload(w: any, compact: boolean, list = false, mode?: string) {
  if (!compact) return w;
  const overview = list && !mode;
  return {...w,
    segments: w.segments.filter((s: any) => !mode || s.mode === mode).map((s: any) =>
      overview ? {...s, geometry: null} : s),
    assets: w.assets.filter((a: any) => !mode || a.mode === mode).map((a: any) => ({...a,
      movement: overview ? null : a.movement,
      trajectory: [], packedTrajectory: overview ? undefined : packTrajectory(a.trajectory, a.movement?.points)
    }))
  };
}
