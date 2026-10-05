import {Type} from 'class-transformer';
import {IsString,IsIn,IsInt,Min,Max,MaxLength,MinLength,IsOptional,IsBoolean,IsArray,ValidateNested,IsISO8601,ArrayMinSize,ArrayMaxSize,ArrayUnique,Matches} from 'class-validator';
export class IntermodalQuery {
 @IsOptional() @IsString() @MaxLength(100) waybill?:string;
 @IsOptional() @IsString() @MaxLength(100) trader?:string;
 @IsOptional() @IsString() @MaxLength(100) carrier?:string;
 @IsOptional() @IsString() @MaxLength(200) origin?:string;
 @IsOptional() @IsString() @MaxLength(200) destination?:string;
 @IsOptional() @IsString() @MaxLength(100) cargo?:string;
 @IsOptional() @IsISO8601() from?:string;
 @IsOptional() @IsISO8601() to?:string;
 @IsOptional() @IsIn(['PENDING','IN_PROGRESS','COMPLETED']) status?:string;
 @Type(()=>Number) @IsInt() @Min(1) page=1;
 @Type(()=>Number) @IsInt() @Min(1) @Max(100) pageSize=10;
}
export class RoadAllocation {
 @IsOptional() @IsString() vehicleId?:string;
 @IsOptional() @IsString() @MinLength(5) @MaxLength(20) plate?:string;
 @IsOptional() @IsInt() @Min(1) @Max(100000) capacityKg?:number;
 @IsString() driverId!:string;
 @IsOptional() @IsInt() @Min(0) @Max(100000) quantityKg?:number;
 @IsOptional() @IsISO8601() startAt?:string;
 @IsOptional() @IsISO8601() endAt?:string;
}
export class StageInput {
 @IsOptional() @IsInt() @Min(1) version?:number;
 @IsIn(['ROAD','WATER','RAIL']) mode!:string;
 @IsString() @MinLength(2) @MaxLength(300) origin!:string;
 @IsString() @MinLength(2) @MaxLength(300) destination!:string;
 @IsInt() @Min(1) @Max(2000000000) quantityKg!:number;
 @IsISO8601() plannedStartAt!:string;
 @IsISO8601() plannedEndAt!:string;
 @IsArray() @ArrayMaxSize(300) @ValidateNested({each:true}) @Type(()=>RoadAllocation) allocations!:RoadAllocation[];
 @IsString() @MaxLength(200) vessel='';
 @IsString() @MaxLength(100) voyage='';
 @IsOptional() @IsString() @MaxLength(100) vesselId?:string;
 @IsOptional() @IsString() @Matches(/^$|^[2-7]\d{8}$/, {message:'MMSI 须为 9 位数字'}) mmsi='';
 @IsString() @MaxLength(100) billOfLading='';
 @IsString() @MaxLength(100) railWaybillNo='';
 @IsBoolean() containerized=false;
 @IsArray() @ArrayMaxSize(5000) @ArrayUnique() @IsString({each:true}) @MaxLength(30,{each:true}) boxes:string[]=[];
 @IsString() @MaxLength(100) weightTicketNo='';
 @IsOptional() @IsInt() @Min(1) @Max(2000000000) grossKg?:number;
 @IsOptional() @IsInt() @Min(0) @Max(2000000000) tareKg?:number;
 @IsString() @MaxLength(2000) notes='';
}
export class StageAction {@IsInt() @Min(1) version!:number;}
export class CompleteStage extends StageAction {
 @IsISO8601() actualEndAt!:string;
 @IsOptional() @IsInt() @Min(1) @Max(2000000000) quantityKg?:number;
 @IsString() @MaxLength(2000) note='';
}
export class ServiceFeeInput {
 @IsString() @MinLength(8) @MaxLength(100) requestKey!:string;
 @IsIn(['SHIP_RELEASE','PORT_MISC','CLEAN_BOX','OTHER']) feeCode!:string;
 @IsInt() @Min(1) @Max(100000000) amountCents!:number;
 @IsString() @MaxLength(2000) description='';
 @IsOptional() @IsString() evidenceId?:string;
}
export class FeeSelection extends StageAction {@IsBoolean() selected!:boolean;}
export class DriverContainer {
 @IsString() @Matches(/^[A-Z]{4}\d{7}$/, {message:'箱号须为 4 位大写字母加 7 位数字'}) boxNo!:string;
 @IsInt() @Min(1) @Max(100000) quantityKg!:number;
}
export class DriverFeedback {
 @IsInt() @Min(1) version!:number;
 @IsString() @MaxLength(100) sealNo='';
 @IsString() @MaxLength(100) weightTicketNo='';
 @IsOptional() @IsInt() @Min(1) @Max(200000) grossKg?:number;
 @IsOptional() @IsInt() @Min(0) @Max(200000) tareKg?:number;
 @IsInt() @Min(1) @Max(100000) quantityKg!:number;
 @IsString() @MinLength(2) @MaxLength(100) receiver!:string;
 @IsString() @MaxLength(2000) note='';
 @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({each:true}) @Type(()=>DriverContainer) containers:DriverContainer[]=[];
}
export class CompleteBusinessItem {
 @IsString() businessId!:string;
 @IsInt() @Min(1) version!:number;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @ArrayUnique() @IsString({each:true}) feeIds!:string[];
}
export class CompleteBusinesses {
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({each:true}) @Type(()=>CompleteBusinessItem) items!:CompleteBusinessItem[];
}
