import {Type} from 'class-transformer';
import {IsString,IsIn,IsInt,Min,Max,MaxLength,MinLength,IsOptional,IsBoolean,IsArray,ValidateNested,IsISO8601,IsNumber} from 'class-validator';
export class SealPlacement {
 @IsNumber() @Min(8) @Max(92) x!:number;
 @IsNumber() @Min(8) @Max(92) y!:number;
}
export class RevisionAction {
 @IsInt() @Min(1) version!:number;
 @IsOptional() @IsString() @MaxLength(2000) reason?:string;
 @IsOptional() @IsIn(['MAIN','ADDENDUM']) documentType?:string;
 @IsOptional() @IsBoolean() acknowledged?:boolean;
 @IsOptional() @ValidateNested() @Type(()=>SealPlacement) seal?:SealPlacement;
}
export class ContractTerms {
 @IsString() @MinLength(2) @MaxLength(2000) settlement!:string;
 @IsString() @MinLength(2) @MaxLength(2000) requirements!:string;
 @IsInt() @Min(0) @Max(100000000) platformFeeCents!:number;
 @IsISO8601() expiresAt!:string;
}
export class CreateContract extends ContractTerms {@IsString() confirmationId!:string;}
export class ChangeContract extends ContractTerms {
 @IsInt() @Min(1) version!:number;
 @IsIn(['CHANGE','TERMINATION']) kind!:string;
 @IsString() @MinLength(2) @MaxLength(2000) reason!:string;
}
export class TemplateDto {
 @IsIn(['MAIN','ADDENDUM']) type!:string;
 @IsString() @MinLength(2) @MaxLength(100) name!:string;
 @IsOptional() @IsString() @MinLength(10) @MaxLength(30000) body?:string;
 @IsOptional() @IsString() fileId?:string;
 @IsIn(['A','B']) mode!:string;
 @IsISO8601() effectiveFrom!:string;
}
export class ContractWorkspaceQuery {
 @IsIn(['signing','performance','archives']) stage='signing';
 @IsOptional() @IsIn(['PENDING','SIGNED','ARCHIVED']) tab?:string;
 @IsOptional() @IsString() @MaxLength(100) q?:string;
 @IsOptional() @IsString() @MaxLength(100) name?:string;
 @IsOptional() @IsIn(['DRAFT','REVIEW','SIGNING','EFFECTIVE','REJECTED','TERMINATED']) status?:string;
 @IsOptional() @IsIn(['MAIN','ADDENDUM']) type?:string;
 @Type(()=>Number) @IsInt() @Min(1) page=1;
 @Type(()=>Number) @IsInt() @Min(1) @Max(100) pageSize=10;
}
export class ContractArchiveDto {
 @IsInt() @Min(1) version!:number;
 @IsString() @MinLength(2) @MaxLength(60) directoryNo!:string;
 @IsString() @MinLength(2) @MaxLength(60) dossierNo!:string;
 @IsIn(['TRANSPORT','MULTIMODAL','TERMINATION']) classification!:string;
 @IsString() @MinLength(2) @MaxLength(100) name!:string;
 @IsIn(['5_YEARS','10_YEARS','30_YEARS','PERMANENT']) retention!:string;
 @IsISO8601() archiveDate!:string;
}
export class SegmentDto {
 @IsIn(['ROAD','RAIL','WATER']) mode!:string;
 @IsString() @MinLength(2) @MaxLength(300) origin!:string;
 @IsString() @MinLength(2) @MaxLength(300) destination!:string;
}
export class BusinessDto {
 @IsString() packageId!:string;
 @IsIn(['SINGLE','TRADITIONAL']) mode!:string;
 @IsBoolean() needsContainerization!:boolean;
 @IsArray() @ValidateNested({each:true}) @Type(()=>SegmentDto) segments!:SegmentDto[];
}
export class VehicleDto {
 @IsString() @MinLength(5) @MaxLength(20) plate!:string;
 @IsInt() @Min(1) @Max(100000) capacityKg!:number;
}
export class TaskDto {
 @IsOptional() @IsString() batchId?:string;
 @IsOptional() @IsString() @MaxLength(30) boxNo?:string;
 @IsInt() @Min(1) @Max(20) segment!:number;
 @IsInt() @Min(1) @Max(2000000000) quantityKg!:number;
 @IsOptional() @IsString() vehicleId?:string;
 @IsOptional() @IsString() driverId?:string;
 @IsString() @MaxLength(500) resource!:string;
}
export class EventDto {
 @IsString() @MinLength(8) @MaxLength(100) requestKey!:string;
 @IsIn(['ACCEPT','RETURN','AT_LOADING','LOAD','DEPART','ARRIVE','UNLOAD','RECEIPT','COMPLETE','POSITION']) type!:string;
 @IsOptional() @IsString() @MaxLength(2000) note?:string;
 @IsOptional() @IsInt() @Min(1) @Max(2000000000) quantityKg?:number;
 @IsOptional() @IsString() @MaxLength(100) receiver?:string;
 @IsOptional() @IsString() evidenceId?:string;
 @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?:number;
 @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?:number;
}
export class IssueDto {
 @IsIn(['VEHICLE','ROAD','WAITING','CARGO','CONTACT','INFORMATION','OTHER']) type!:string;
 @IsString() @MinLength(2) @MaxLength(2000) description!:string;
}
export class ResolutionDto {@IsString() @MinLength(2) @MaxLength(2000) resolution!:string;}
export class BatchDto {
 @IsString() @MinLength(2) @MaxLength(100) name!:string;
 @IsInt() @Min(1) @Max(2000000000) quantityKg!:number;
}
export class ArrivalDto {
 @IsInt() @Min(1) version!:number;
 @IsString() @MinLength(5) @MaxLength(20) plate!:string;
 @IsInt() @Min(1) @Max(200000) grossKg!:number;
 @IsInt() @Min(0) @Max(200000) tareKg!:number;
 @IsString() @MinLength(2) @MaxLength(100) ticketNo!:string;
}
export class BoxSource {
 @IsString() arrivalId!:string;
 @IsInt() @Min(1) @Max(100000) quantityKg!:number;
}
export class BoxDto {
 @IsInt() @Min(1) version!:number;
 @IsString() @MinLength(5) @MaxLength(30) boxNo!:string;
 @IsString() @MinLength(2) @MaxLength(30) seal!:string;
 @IsIn(['20GP','40GP']) boxType!:string;
 @IsString() @MaxLength(200) vessel!:string;
 @IsString() @MaxLength(100) voyage!:string;
 @IsArray() @ValidateNested({each:true}) @Type(()=>BoxSource) sources!:BoxSource[];
}
