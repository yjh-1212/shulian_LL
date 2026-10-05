import {Type} from 'class-transformer';
import {IsString,MinLength,MaxLength,IsIn,IsISO8601,IsOptional,IsNumber,IsInt,Min,Max,IsBoolean,ValidateNested,ArrayMinSize,ArrayMaxSize,IsArray} from 'class-validator';
export class TrackingQuery {
 @IsOptional() @IsString() @MaxLength(100) q?:string;
 @IsOptional() @IsIn(['ROAD','RAIL','WATER']) mode?:string;
 @IsOptional() @IsIn(['DISPATCHED','ACCEPTED','AT_LOADING','LOADED','IN_TRANSIT','ARRIVED','UNLOADED','RECEIVED','COMPLETED','RETURNED','CANCELLED']) status?:string;
 @IsOptional() @IsIn(['true','false']) includeTest?:string;
 @IsOptional() @IsIn(['true','false']) risk?:string;
 @IsOptional() @Type(()=>Number) @IsInt() @Min(1) page=1;
 @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) pageSize=20;
 @IsOptional() @IsISO8601() from?:string;
 @IsOptional() @IsISO8601() to?:string;
}
export class PositionInput {
 @IsString() @MinLength(2) @MaxLength(100) sourceSystem!:string;
 @IsString() @MinLength(1) @MaxLength(100) sourceRecordId!:string;
 @IsIn(['GPS','BEIDOU','AIS','HISTORICAL_AIS','SIMULATED']) sourceType!:string;
 @IsString() @MinLength(1) @MaxLength(100) assetId!:string;
 @IsISO8601() observedAt!:string;
 @IsNumber() @Min(-180) @Max(180) longitude!:number;
 @IsNumber() @Min(-90) @Max(90) latitude!:number;
 @IsIn(['GCJ02','WGS84']) coordinateSystem!:string;
}
export class PositionBatch { @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>PositionInput) points!:PositionInput[]; }
export class ObservationInput {
 @IsString() @MinLength(2) @MaxLength(100) sourceSystem!:string;
 @IsString() @MinLength(1) @MaxLength(100) sourceRecordId!:string;
 @IsIn(['RAIL','EPCIS']) sourceType!:string;
 @IsIn(['DEPARTURE','ARRIVAL','TRANSFER','LOADING','UNLOADING','DELIVERY']) eventType!:string;
 @IsOptional() @IsString() @MaxLength(100) nodeId?:string;
 @IsString() @MinLength(2) @MaxLength(200) nodeName!:string;
 @IsISO8601() observedAt!:string;
 @IsOptional() @IsBoolean() simulated=false;
}
export class EpcisInput {
 @IsString() @MinLength(2) @MaxLength(100) sourceSystem!:string;
 @IsString() @MinLength(1) @MaxLength(100) eventID!:string;
 @IsIn(['ObjectEvent']) type!:string;
 @IsIn(['OBSERVE']) action!:string;
 @IsISO8601() eventTime!:string;
 @IsIn(['+08:00']) eventTimeZoneOffset!:string;
 @IsIn(['shipping','receiving','loading','unloading','transporting']) bizStep!:string;
 @IsString() @MinLength(2) @MaxLength(200) readPoint!:string;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @IsString({each:true}) @MaxLength(200,{each:true}) epcList!:string[];
 @IsOptional() @IsString() nodeId?:string;
 @IsOptional() @IsBoolean() simulated=false;
}
export class RuleInput {
 @IsInt() @Min(5) @Max(1440) staleMinutes!:number;
 @IsInt() @Min(10) @Max(1440) stationaryMinutes!:number;
 @IsInt() @Min(10) @Max(5000) stationaryMeters!:number;
 @IsInt() @Min(100) @Max(50000) deviationMeters!:number;
 @IsInt() @Min(1) @Max(168) nodeHours!:number;
 @IsInt() @Min(1) version!:number;
}
