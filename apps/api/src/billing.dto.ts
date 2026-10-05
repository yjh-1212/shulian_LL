import {Type} from 'class-transformer';import {IsString,IsInt,Min,Max,IsOptional,IsArray,ArrayMinSize,ArrayMaxSize,ArrayUnique,MaxLength,MinLength,ValidateNested,IsIn,IsISO8601,IsBoolean} from 'class-validator';
export class BillItemInput {
 @IsString() @MaxLength(100) feeCode!:string;
 @IsOptional() @IsString() @MaxLength(100) taskId?:string;
 @IsOptional() @IsString() @MaxLength(100) sourceId?:string;
 @IsInt() @Min(1) @Max(100000000) quantityMillis!:number;
 @IsIn(['吨','车','箱','次','天']) unit!:string;
 @IsInt() @Min(0) @Max(100000000) unitPriceCents!:number;
 @IsInt() @Min(0) @Max(1000000000) originalCents!:number;
 @IsInt() @Min(-1000000000) @Max(1000000000) adjustmentCents!:number;
 @IsISO8601() occurredAt!:string;
 @IsString() @MinLength(2) @MaxLength(2000) basis!:string;
}
export class BillDraft {
 @IsString() businessId!:string;
 @IsArray() @ArrayUnique() @ArrayMinSize(1) @ArrayMaxSize(10000) @IsString({each:true}) taskIds!:string[];
 @IsISO8601() periodFrom!:string;
 @IsISO8601() periodTo!:string;
 @IsString() @MaxLength(2000) remark!:string;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @ValidateNested({each:true}) @Type(()=>BillItemInput) items!:BillItemInput[];
 @IsOptional() @IsInt() @Min(1) version?:number;
 @IsOptional() @IsString() @MaxLength(2000) reason?:string;
}
export class BillAction {
 @IsInt() @Min(1) version!:number;
 @IsOptional() @IsString() @MaxLength(2000) reason?:string;
}
export class DifferenceInput extends BillAction {
 @IsOptional() @IsInt() @Min(1) itemSequence?:number;
 @IsIn(['QUANTITY','PRICE','FEE','AMOUNT','DUPLICATE','EVIDENCE','OTHER']) type!:string;
 @IsString() @MinLength(2) @MaxLength(2000) description!:string;
 @IsInt() @Min(0) @Max(1000000000) acceptedCents!:number;
}
export class SettlementInput extends BillAction {
 @IsString() @MinLength(8) @MaxLength(100) requestKey!:string;
 @IsInt() @Min(1) @Max(1000000000) amountCents!:number;
 @IsString() @MinLength(2) @MaxLength(100) method!:string;
 @IsISO8601() plannedAt!:string;
 @IsISO8601() actualAt!:string;
 @IsString() evidenceId!:string;
 @IsString() @MaxLength(2000) note!:string;
}
export class SettlementConfirm extends BillAction { @IsBoolean() accepted!:boolean; }
export class FinanceQuery {
 @IsOptional() @IsString() @MaxLength(100) q?:string;
 @IsOptional() @IsIn(['DRAFT','SENT','CHECKING','DISPUTED','RECHECK','CONFIRMED','VOID','PENDING','PARTIAL','SETTLED','EXCEPTION']) status?:string;
 @IsOptional() @IsIn(['true','false']) includeTest?:string;
 @IsOptional() @Type(()=>Number) @IsInt() @Min(1) page=1;
 @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) pageSize=20;
}
