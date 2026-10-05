import {Type} from 'class-transformer';
import {IsOptional,IsString,MaxLength,IsIn,IsInt,Min,Max} from 'class-validator';
export class WaybillTrackingQuery {
 @IsOptional() @IsString() @MaxLength(100) waybill?:string;
 @IsOptional() @IsString() @MaxLength(100) shipper?:string;
 @IsOptional() @IsString() @MaxLength(100) cargo?:string;
 @IsOptional() @IsString() @MaxLength(200) origin?:string;
 @IsOptional() @IsString() @MaxLength(200) destination?:string;
 @IsOptional() @IsString() @MaxLength(100) asset?:string;
 @IsOptional() @IsString() @MaxLength(9) mmsi?:string;
 @IsOptional() @Type(()=>Number) @IsInt() @Min(0) @Max(2000000000) minKg?:number;
 @IsOptional() @Type(()=>Number) @IsInt() @Min(0) @Max(2000000000) maxKg?:number;
 @IsOptional() @IsIn(['ROAD','RAIL','WATER']) mode?:string;
 @IsOptional() @IsIn(['PENDING','IN_PROGRESS','COMPLETED']) status?:string;
 @IsOptional() @IsIn(['true','false']) includeTest?:string;
 @IsOptional() @Type(()=>Number) @IsInt() @Min(1) page=1;
 @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(50) pageSize=12;
}
