/** Restore exact trajectories before maps, position interpolation and replay read them. */
export function unpackTracking(w: any) {
  return {...w, assets: w.assets.map((a: any) => {
    const packed = a.packedTrajectory;
    if (!packed) return a;
    return {...a, trajectory: packed.rows.map((row: any[], index: number) => {
      const point = {...packed.defaults};
      if (packed.routePoints) {
        const reference = packed.routePoints[index];
        const coords = typeof reference === 'number' ? a.movement.points[reference] : reference;
        Object.assign(point, {longitude: coords[0], latitude: coords[1], observedAt: new Date(coords[2]).toISOString()});
      }
      packed.fields.forEach((field: string, i: number) => {
        if (row[i] !== null) point[field] = field === 'observedAt' ? new Date(row[i]).toISOString() :
          field === 'id' && packed.idPrefix ? packed.idPrefix + row[i] : row[i];
      });
      return point;
    }), packedTrajectory: undefined};
  })};
}
