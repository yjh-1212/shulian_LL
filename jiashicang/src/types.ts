export type View = 'platform' | 'chain';
export type Mode = 'ROAD' | 'RAIL' | 'WATER';
export interface Point {name?:string;lng:number;lat:number;source?:string;at?:string;observedAt?:string}
export interface Business {id:string;businessNo:string;waybillNo:string;contractNo:string;grain:string;quantityKg:number;totalCents?:number;status:string;origin:string;destination:string;trader:string;carrier:string;nodes:Point[];modes:Mode[];segments?:{mode:Mode;origin:string;destination:string}[];createdAt:string;referenceData:boolean;stageCount:number;completedStages:number}
export interface Breakdown {name:string;value:number}
export interface Overview {
 statistics:Statistics;
 asOf:string;scope:string;permissions:Record<string,boolean>;grains:string[];
 metrics:{demandCount:number|null;activeCount:number|null;transportedKg:number|null;completedKg:number|null;riskCount:number|null};
 demandGroups:Breakdown[];demands:{id:string;no:string;name:string;quantityKg:number;status:string}[];
 grainVolumes:Breakdown[];trend:Breakdown[];resources:{partners:number;activeVehicles:number;supplies:number;modes:Breakdown[]};
 contractGroups:Breakdown[];contracts:{id:string;no:string;status:string;quantityKg:number}[];
 risks:{id:string;message:string;level:string;businessId:string;lastSeenAt:string}[];
 finance:{billCount:number;totalCents:number;settledCents:number;outstandingCents:number;groups:Breakdown[]}|null;
 businesses:Business[];provenance:{addedRecords:number;initializedBusinesses:number;note:string};
}
export interface Series {name:string;first:number;second:number;line?:number}
export interface Statistics {
 volumeTrend:Breakdown[];coordinationTrend:Series[];financeTrend:Series[];modeVolumes:Breakdown[];origins:Breakdown[];destinations:Breakdown[];
 heatmap:{grain:string;mode:string;value:number}[];
 links:{source:string;target:string;column:number;value:number}[];
 scatter:{grain:string;x:number;y:number;status:string}[];
 riskGroups:Breakdown[];
 fulfillment:{total:number;completed:number;active:number;completionRate:number|null;contracts:number};
 coordination:{demands:number;matched:number;supplies:number};costBasis:string;financeBasis:string;flowBasis:string;
}
export interface Asset {id:string;taskNo:string;mode:Mode;status:string;title:string;position:Point|null;trajectory:Point[];feedbackAt:string|null;plannedStartAt:string|null;plannedEndAt:string|null;issues:{id:string;description:string}[];eta:any}
export interface Chain extends Omit<Business,'segments'> {
 loadingType:string;contractStatus:string;demandNo:string|null;tradeNo:string|null;
 segments:{sequence:number;mode:Mode;origin:Point;destination:Point;geometry:{source:string;coordinates:number[][]}|null}[];
 progress:{id:string;mode:Mode;origin:string;destination:string;targetKg:number;arrivedKg:number;shippedKg:number;reportedKg:number;awaitingEvidenceKg:number;percent:number;unverifiedTasks:number;warnings:string[]}[];
 assets:Asset[];risks:{id:string;message:string;level:string;at:string}[];
 documents:{id:string;name:string;category:string;stage:number;mode:Mode;taskNo?:string;createdAt:string}[];
 bills:{id:string;businessNo:string;totalCents:number;status:string;settlement:{settledCents:number;status:string}|null}[];
 batches:{id:string;name:string;quantityKg:number;boxCount:number}[];
 stages:{id:string;sequence:number;mode:Mode;origin:string;destination:string;status:string;plannedStartAt:string;plannedEndAt:string;completedAt:string|null;vessel:string;voyage:string;railWaybillNo:string;taskCount:number}[];
 asOf:string;
}
export interface MapRoute {id:string;mode:Mode;points:Point[];label:string;schematic:boolean;selected:boolean;businessId?:string;quantityKg?:number;dimmed?:boolean}
export interface MapNode extends Point {id:string;name:string;kind?:string;role?:'source'|'target'|'transfer';selected?:boolean;businessId?:string;quantityKg?:number;dimmed?:boolean;province?:string}
export interface NetworkSegment {id:string;key:string;mode:Mode;origin:string;destination:string;coordinates:number[][];distanceMeters:number;source:string;sourceUrl:string;sourceLabel:string;basis:string;queriedAt:string|null;connectionMeters?:{origin:number;destination:number}|null;railLineNames?:string[]}
export interface NetworkReference {version:number;coordinateSystem:string;nodes:MapNode[];segments:NetworkSegment[];sources:Record<string,string>}
export interface Corridor {id:string;label:string;origin:string;destination:string;combination:string;quantityKg:number;businessIds:string[];grains:string[];segments:NetworkSegment[];nodeNames:string[];completed:number;active:number;missingSegments:number}
export type MapSelection={kind:'route'|'node'|'region';id:string};
export interface MapHover {selection:MapSelection;x:number;y:number}
export interface ChartSelection {dimension:'grain'|'origin'|'destination'|'mode'|'status'|'risk';value:string;grain?:string}
export interface PlaybackFrame {point:Point|null;heading:number;mode:Mode;segmentId:string;phase:'moving'|'handoff'|'gap'|'complete';label:string;percent:number}
