import {IsString,MinLength,MaxLength,IsIn,IsInt,Min,Max,IsOptional,IsArray,ArrayMinSize,ArrayMaxSize,ArrayUnique,IsISO8601,Equals} from 'class-validator';
export class ProductInput {
 @IsString() @MinLength(2) @MaxLength(40) code!:string;
 @IsString() @MinLength(2) @MaxLength(100) name!:string;
 @IsString() @MinLength(2) @MaxLength(2000) description!:string;
 @IsString() @MinLength(2) @MaxLength(100) theme!:string;
 @IsIn(['TASKS','METRICS','LINES','CAPACITY','CORRIDOR','TRACE','CREDIT','RISK']) dataset!:string;
 @IsArray() @ArrayUnique() @ArrayMinSize(1) @ArrayMaxSize(20) @IsString({each:true}) fields!:string[];
 @IsString() @MinLength(2) @MaxLength(500) source!:string;
 @IsIn(['实时','每小时','每日','按需']) frequency!:string;
 @IsString() @MinLength(2) @MaxLength(500) coverage!:string;
 @IsIn(['API','FILE','BOTH']) serviceMode!:string;
 @IsIn(['JSON','CSV']) format!:string;
 @IsString() @MinLength(2) @MaxLength(100) owner!:string;
 @IsString() @MinLength(2) @MaxLength(2000) conditions!:string;
 @IsOptional() @IsInt() @Min(1) version?:number;
}
export class DataState {
 @IsString() @MaxLength(40) status!:string;
 @IsInt() @Min(1) version!:number;
}
export class GrantInput {
 @IsString() productId!:string;
 @IsInt() @Min(1) productVersion!:number;
 @IsString() entityId!:string;
 @IsString() @MinLength(2) @MaxLength(1000) purpose!:string;
 @IsIn(['OWN','AGGREGATE','PUBLIC']) scope!:string;
 @IsArray() @ArrayUnique() @ArrayMinSize(1) @ArrayMaxSize(20) @IsString({each:true}) fields!:string[];
 @IsString() @MinLength(2) @MaxLength(2000) basis!:string;
 @IsString() @MinLength(2) @MaxLength(100) approver!:string;
 @IsISO8601() startsAt!:string;
 @IsISO8601() expiresAt!:string;
}
export class SubscriptionInput {
 @IsString() authorizationId!:string;
 @IsString() @MinLength(2) @MaxLength(100) name!:string;
 @IsIn(['实时','每小时','每日','按需']) frequency!:string;
 @IsIn(['API','FILE']) mode!:string;
 @IsInt() @Min(1) @Max(10000) dailyLimit!:number;
}
export class ApplicationInput {
 @IsString() @MinLength(2) @MaxLength(100) name!:string;
 @IsString() @MinLength(2) @MaxLength(2000) description!:string;
 @IsArray() @ArrayUnique() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({each:true}) subscriptionIds!:string[];
 @IsOptional() @IsInt() @Min(1) version?:number;
}
export class DataRequestInput {
 @IsString() productId!:string;
 @IsString() @MinLength(2) @MaxLength(80) department!:string;
 @IsString() @MinLength(2) @MaxLength(100) applicationName!:string;
 @IsArray() @ArrayUnique() @ArrayMinSize(1) @ArrayMaxSize(5) @IsIn(['运输规划','运输执行','合作评估','经营分析','其他'],{each:true}) scenarios!:string[];
 @IsString() @MinLength(10) @MaxLength(1000) purpose!:string;
 @IsIn(['BASIC','STANDARD','ENTERPRISE']) edition!:string;
 @IsIn(['OWN','AGGREGATE','PUBLIC']) scope!:string;
 @IsISO8601() startsAt!:string;
 @IsISO8601() expiresAt!:string;
 @IsOptional() @IsString() @MaxLength(100) origin?:string;
 @IsOptional() @IsString() @MaxLength(100) destination?:string;
 @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(20) @IsString({each:true}) waybillIds?:string[];
 @Equals(true) accepted!:boolean;
}
export class DataReviewInput {
 @IsInt() @Min(1) version!:number;
 @IsIn(['APPROVED','REJECTED']) status!:string;
 @IsString() @MinLength(2) @MaxLength(1000) note!:string;
 @IsOptional() @IsInt() @Min(1) @Max(10000) dailyLimit?:number;
}
export class DataQuery {
 @IsOptional() @IsString() @MaxLength(100) waybillNo?:string;
 @IsOptional() @IsString() @MaxLength(100) origin?:string;
 @IsOptional() @IsString() @MaxLength(100) destination?:string;
 @IsOptional() @IsIn(['DAY','WEEK','MONTH']) period?:string;
 @IsOptional() @IsISO8601() from?:string;
 @IsOptional() @IsISO8601() to?:string;
 @IsOptional() @IsIn(['3','12']) months?:string;
}
