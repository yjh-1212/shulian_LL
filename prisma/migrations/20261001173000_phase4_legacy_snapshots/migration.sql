-- Preserve the best available legacy business fields at migration time.
UPDATE "MatchPublication" SET "snapshot"=(
 SELECT json_object('legacySnapshot',json('true'),'name',d.name,'businessNo',d.businessNo,
 'grain',g.label,'cargoName',i.cargoName,'specification',i.specification,'quantityKg',d.quantityKg,
 'originRegion',d.originRegion,'originAddress',d.originAddress,'destinationRegion',d.destinationRegion,'destinationAddress',d.destinationAddress,
 'departureAt',strftime('%Y-%m-%dT%H:%M:%fZ',d.departureAt/1000.0,'unixepoch'),
 'arrivalAt',strftime('%Y-%m-%dT%H:%M:%fZ',d.arrivalAt/1000.0,'unixepoch'),
 'loadingType',d.loadingType,'allowTransfer',d.allowTransfer,'maxTransfers',d.maxTransfers,'notes',d.notes,
 'modes',json((SELECT json_group_array(m.label) FROM "DemandMode" dm JOIN "Dictionary" m ON m.id=dm.modeId WHERE dm.demandId=d.id)))
 FROM "TransportDemand" d JOIN "TradeOrderItem" i ON i.id=d.orderItemId JOIN "Dictionary" g ON g.id=i.grainId
 WHERE d.id="MatchPublication".demandId
) WHERE snapshot='{}';
UPDATE "MatchPublication" SET "snapshot"=json_set(snapshot,'$.privateInfo',json((
 SELECT json_object('budgetCents',d.budgetCents,'contact',d.contact,'phone',d.phone) FROM "TransportDemand" d WHERE d.id="MatchPublication".demandId
))) WHERE json_type(snapshot,'$.privateInfo') IS NULL;
UPDATE "MatchPublication" SET stage='REMATCH' WHERE status IN ('CLOSED','EXPIRED') AND matchedKg=0;
UPDATE "TransportDemand" SET matchStage=COALESCE((SELECT stage FROM "MatchPublication" p WHERE p.demandId="TransportDemand".id AND p.status='ACTIVE' ORDER BY p.createdAt DESC LIMIT 1),'REMATCH') WHERE matchedKg=0 AND EXISTS (SELECT 1 FROM "MatchPublication" p WHERE p.demandId="TransportDemand".id);
