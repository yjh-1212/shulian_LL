/** Lists carry their visible fields; detail endpoints retain complete documents and routes. */
export function contractSummary(p: any) {
  return {
    id: p.id, businessNo: p.businessNo, quantityKg: p.quantityKg, totalCents: p.totalCents,
    status: p.status, createdAt: p.createdAt, readOnly: p.readOnly, contractName: p.contractName,
    ownSigned: p.ownSigned, progress: p.progress, archiveRecord: p.archiveRecord,
    snapshot: {grain: p.snapshot.grain, trader: {name: p.snapshot.trader?.name}, carrier: {name: p.snapshot.carrier?.name}},
    revisions: p.revisions.map((r: any) => ({id: r.id, number: r.number, kind: r.kind, status: r.status, mode: r.mode}))
  };
}

export function intermodalSummary(b: any) {
  return {...b, segments: undefined,
    package: {id: b.package.id, businessNo: b.package.businessNo, status: b.package.status,
      quantityKg: b.package.quantityKg, totalCents: b.package.totalCents,
      snapshot: {loadingType: b.package.snapshot.loadingType}},
    stages: b.stages.map((s: any) => ({...s, allocations: undefined, attachments: undefined,
      tasks: s.tasks.map((t: any) => ({id: t.id, businessNo: t.businessNo, resource: t.resource,
        status: t.status, unloadedKg: t.unloadedKg, feedbackSubmittedAt: t.feedbackSubmittedAt,
        plannedStartAt: t.plannedStartAt, plannedEndAt: t.plannedEndAt,
        vehicle: {plate: t.vehicle?.plate}, driver: t.driver, feedback: {quantityKg: t.feedback?.quantityKg}}))}))
  };
}

export function billSummary(b: any) {
  const ref = b.reference, snapshot = ref.snapshot || {};
  return {...b, versions: undefined, reference: {...ref, tasks: undefined, terms: undefined,
    snapshot: {grain: snapshot.grain, trader: {name: snapshot.trader?.name}, carrier: {name: snapshot.carrier?.name},
      origin: snapshot.origin, destination: snapshot.destination, loadingType: snapshot.loadingType}}};
}

export function trackingSummary(w: any) {
  return {...w,
    // Vendor turn-by-turn instructions are irrelevant to drawing the exact saved path.
    segments: w.segments.map((s: any) => {
      if (!s.geometry) return s;
      const {steps, ...geometry} = s.geometry;
      return {...s, geometry};
    }),
    assets: w.assets.map((a: any) => {
      // The complete timed path is already carried in movement.points.
      const {referenceRoadMotion, ...feedback} = a.feedback || {};
      return {...a, feedback};
    })
  };
}
