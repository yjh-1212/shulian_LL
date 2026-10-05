import {Type} from 'class-transformer';
import {IsString,MinLength,MaxLength,IsIn,IsOptional,IsInt,IsNumber,Min,Max,IsArray,ArrayMinSize,ArrayMaxSize,IsISO8601,IsBoolean,ValidateNested} from 'class-validator';
export class AgentInput {
 @IsIn(['TRACK','ETA','PORT','ENVIRONMENT','DOCUMENT','PLAN']) capability!:string;
 @IsIn(['page','task','transport-demand','plan','bill','document']) contextType!:string;
 @IsOptional() @IsString() @MaxLength(100) contextId?:string;
 @IsString() @MinLength(2) @MaxLength(2000) question!:string;
 @IsOptional() @IsBoolean() includeTest=false;
 @IsOptional() @IsBoolean() useModel=true;
}
export class SignalInput {
 @IsOptional() @IsInt() @Min(1) version?:number;
 @IsIn(['PORT','ENVIRONMENT']) kind!:string;
 @IsString() @MinLength(2) @MaxLength(100) name!:string;
 @IsOptional() @IsString() @MaxLength(100) nodeId?:string;
 @IsString() @MaxLength(200) region!:string;
 @IsArray() @ArrayMaxSize(4) @IsNumber({}, {each:true}) bounds!:number[];
 @IsIn(['LOW','MEDIUM','HIGH']) level!:string;
 @IsInt() @Min(0) @Max(10080) delayMinutes!:number;
 @IsString() @MinLength(2) @MaxLength(2000) details!:string;
 @IsString() @MinLength(2) @MaxLength(200) source!:string;
 @IsString() @MaxLength(1000) sourceUrl!:string;
 @IsISO8601() observedAt!:string;
 @IsISO8601() validFrom!:string;
 @IsISO8601() validTo!:string;
 @IsBoolean() isTestData!:boolean;
}
export class WeatherInput { @IsString() @MinLength(6) @MaxLength(6) city!:string; @IsString() @MinLength(1) @MaxLength(100) nodeId!:string; }
export class DocumentFields {
 @IsString() @MaxLength(100) waybillNo!:string;
 @IsString() @MaxLength(100) cargo!:string;
 @IsString() @MaxLength(200) origin!:string;
 @IsString() @MaxLength(200) destination!:string;
 @IsString() @MaxLength(200) carrier!:string;
 @IsOptional() @IsNumber({maxDecimalPlaces:3}) @Min(0.001) @Max(100000) quantityTons?:number;
 @IsString() @MaxLength(100) date!:string;
}
export class ConfirmDocument {
 @IsInt() @Min(1) version!:number;
 @IsBoolean() acknowledged!:boolean;
 @ValidateNested() @Type(()=>DocumentFields) fields!:DocumentFields;
}
