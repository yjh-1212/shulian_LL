import {ApiProperty,ApiPropertyOptional} from '@nestjs/swagger';
import {IsDefined,IsString,Length,IsOptional,IsNumber,Min,Max,IsArray,ArrayMinSize,ArrayMaxSize,ArrayUnique,IsIn,IsBoolean,IsInt,IsISO8601,ValidateNested,IsUrl} from 'class-validator';
import {Type} from 'class-transformer';
import {ListDto} from './dto';
export class PointDto {
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(0,200) matchedAddress?:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsIn(['NODE','POI','GEOCODE','MAP','APPROXIMATE']) matchKind?:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(0,40) matchLevel?:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(0,50) province?:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(0,50) city?:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(0,50) district?:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(0,10) adcode?:string;
 @ApiProperty({type:String}) @IsString() @Length(1,160) name!:string;
 @ApiProperty({type:Number}) @IsNumber() @Min(73) @Max(136) lng!:number;
 @ApiProperty({type:Number}) @IsNumber() @Min(3) @Max(54) lat!:number;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(1,100) nodeId?:string;
}
export class SolveDto {
 @ApiPropertyOptional({type:Boolean}) @IsOptional() @IsBoolean() allowModel?:boolean;
 @ApiPropertyOptional({type:Boolean}) @IsOptional() @IsBoolean() allowContainerization?:boolean;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(1,60) demandId?:string;
 @ApiPropertyOptional({type:Number}) @IsOptional() @IsInt() @Min(1) demandVersion?:number;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(1,60) previousRunId?:string;
 @ApiProperty({type:String}) @IsString() @Length(1,60) grainId!:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(0,100) cargoName?:string;
 @ApiProperty({type:Number}) @IsNumber({maxDecimalPlaces:3}) @Min(.001) @Max(100000) quantity!:number;
 @ApiPropertyOptional({type:Number,description:'整单总预算下限，单位元'}) @IsOptional() @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(20000000) minBudget?:number;
 @ApiPropertyOptional({type:Number,description:'整单总预算上限，单位元'}) @IsOptional() @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(20000000) maxBudget?:number;
 @ApiProperty({type:PointDto}) @IsDefined() @ValidateNested() @Type(()=>PointDto) origin!:PointDto;
 @ApiProperty({type:PointDto}) @IsDefined() @ValidateNested() @Type(()=>PointDto) destination!:PointDto;
 @ApiProperty({type:String}) @IsISO8601({strict:true}) departureAt!:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsISO8601({strict:true}) arrivalAt?:string;
 @ApiProperty({type:[String]}) @IsArray() @ArrayUnique() @ArrayMaxSize(3) @IsIn(['ROAD','RAIL','WATER'],{each:true}) modes!:string[];
 @ApiProperty({type:Boolean}) @IsBoolean() allowMultimodal!:boolean;
 @ApiProperty({type:Boolean}) @IsBoolean() allowTransfer!:boolean;
 @ApiProperty({type:Number}) @IsInt() @Min(0) @Max(4) maxTransfers!:number;
 @ApiProperty({type:String}) @IsIn(['BULK','CONTAINER']) loadingType!:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsIn(['20GP','40GP']) containerType?:string;
 @ApiPropertyOptional({type:Number}) @IsOptional() @IsInt() @Min(1) @Max(10000) containerCount?:number;
 @ApiProperty({type:String}) @IsIn(['COST','TIME','BALANCED']) preference!:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(0,100) requiredNodeId?:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(0,100) requiredLineId?:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(0,2000) notes?:string;
}
export class NodeDto extends PointDto {
 @ApiProperty({type:String}) @IsIn(['PORT','RAIL','WAREHOUSE','LOGISTICS']) type!:string;
 @ApiProperty({type:String}) @IsString() @Length(1,50) province='';
 @ApiProperty({type:String}) @IsString() @Length(1,50) city='';
 @ApiProperty({type:String}) @IsString() @Length(1,50) district='';
 @ApiProperty({type:String}) @IsString() @Length(0,200) address!:string;
 @ApiProperty({type:String}) @IsString() @Length(2,120) source!:string;
 @ApiProperty({type:String}) @IsString() @Length(1,160) sourceRef!:string;
 @ApiProperty({type:String}) @IsUrl({protocols:['https'],require_protocol:true}) sourceUrl!:string;
 @ApiProperty({type:String}) @IsIn(['PROVIDER','VERIFIED','DRAFT']) quality!:string;
 @ApiProperty({type:Boolean}) @IsBoolean() enabled!:boolean;
 @ApiPropertyOptional({type:Number}) @IsOptional() @IsInt() @Min(1) version?:number;
}
export class LineDto {
 @ApiProperty({type:String}) @IsString() @Length(2,100) name!:string;
 @ApiProperty({type:String}) @IsIn(['ROAD','RAIL','WATER']) mode!:string;
 @ApiProperty({type:String}) @IsString() @Length(1,100) originId!:string;
 @ApiProperty({type:String}) @IsString() @Length(1,100) destinationId!:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(0,500) viaNodes?:string;
 @ApiProperty({type:Number}) @IsNumber({maxDecimalPlaces:3}) @Min(.001) @Max(50000) distanceKm!:number;
 @ApiProperty({type:Number}) @IsNumber({maxDecimalPlaces:2}) @Min(.01) @Max(10000) durationHours!:number;
 @ApiPropertyOptional({type:Number}) @IsOptional() @IsNumber({maxDecimalPlaces:3}) @Min(.001) @Max(1000000) capacity?:number;
 @ApiProperty({type:[String]}) @IsArray() @ArrayMaxSize(30) @ArrayUnique() @IsString({each:true}) grainIds!:string[];
 @ApiProperty({type:[String]}) @IsArray() @ArrayMaxSize(2) @ArrayUnique() @IsIn(['BULK','CONTAINER'],{each:true}) loadingTypes!:string[];
 @ApiProperty({type:Number}) @IsInt() @Min(0) @Max(10080) transferMinutes!:number;
 @ApiProperty({type:String}) @IsString() @Length(2,120) source!:string;
 @ApiProperty({type:String}) @IsString() @Length(1,160) sourceRef!:string;
 @ApiProperty({type:String}) @IsUrl({protocols:['https'],require_protocol:true}) sourceUrl!:string;
 @ApiProperty({type:String}) @IsString() @Length(2,100) maintainer!:string;
 @ApiProperty({type:String}) @IsIn(['DRAFT','VERIFIED']) quality!:string;
 @ApiProperty({type:Boolean}) @IsBoolean() enabled!:boolean;
 @ApiPropertyOptional({type:Number}) @IsOptional() @IsInt() @Min(1) version?:number;
}
export class PriceDto {
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(1,100) lineId?:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(1,100) grainId?:string;
 @ApiProperty({type:String}) @IsIn(['PER_TON_KM','PER_TON','PER_CONTAINER','FIXED']) unit!:string;
 @ApiProperty({type:Number}) @IsNumber({maxDecimalPlaces:3}) @Min(.001) @Max(1000000) rate!:number;
 @ApiProperty({type:String}) @IsISO8601({strict:true}) validFrom!:string;
 @ApiProperty({type:String}) @IsISO8601({strict:true}) validUntil!:string;
 @ApiProperty({type:String}) @IsString() @Length(2,200) source!:string;
 @ApiProperty({type:String}) @IsString() @Length(2,100) maintainer!:string;
 @ApiProperty({type:Boolean}) @IsBoolean() enabled!:boolean;
 @ApiPropertyOptional({type:Number}) @IsOptional() @IsInt() @Min(1) version?:number;
}
export class GeometryDto {
 @ApiProperty({type:Number}) @IsInt() @Min(1) version!:number;
 @ApiProperty({type:'array',items:{type:'array',items:{type:'number'},minItems:2,maxItems:2}}) @IsArray() @ArrayMaxSize(50000) coordinates!:number[][];
 @ApiProperty({type:String}) @IsIn(['VERIFIED_RAIL','PLANNED_WATER','HISTORICAL_AIS']) routeProfile!:string;
 @ApiProperty({type:String}) @IsString() @Length(2,200) source!:string;
 @ApiProperty({type:String}) @IsUrl({protocols:['https'],require_protocol:true}) sourceRef!:string;
}
export class PlanSelectDto {
 @ApiProperty({type:String}) @IsString() @Length(1,100) candidateId!:string;
 @ApiProperty({type:Number}) @IsInt() @Min(1) revision!:number;
}
export class PlanSupplierDto {
 @ApiProperty({type:String}) @IsString() @Length(1,60) targetCarrierId!:string;
 @ApiProperty({type:String}) @IsString() @Length(1,60) supplyId!:string;
 @ApiProperty({type:Number}) @IsInt() @Min(1) supplyVersion!:number;
}
export class PlanPublishDto extends PlanSelectDto {
 @ApiPropertyOptional({type:[PlanSupplierDto]}) @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({each:true}) @Type(()=>PlanSupplierDto) suppliers?:PlanSupplierDto[];
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(1,60) targetCarrierId?:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(1,60) supplyId?:string;
 @ApiPropertyOptional({type:Number}) @IsOptional() @IsInt() @Min(1) supplyVersion?:number;
 @ApiProperty({type:String}) @IsISO8601({strict:true}) deadline!:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(1,40) contact?:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(6,30) phone?:string;
}
export class PlanQuery extends ListDto {
 @ApiPropertyOptional({type:String}) @IsOptional() @IsIn(['ROAD','RAIL','WATER']) mode?:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(0,100) demandId?:string;
 @ApiPropertyOptional({type:String}) @IsOptional() @IsString() @Length(0,100) lineId?:string;
}
