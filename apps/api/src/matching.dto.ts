import {ApiProperty,ApiPropertyOptional} from '@nestjs/swagger';
import { IsString,IsOptional,IsIn,IsBoolean,IsInt,Min,Max,Length,IsISO8601,IsNumber,ValidateNested,IsArray,ArrayMinSize,ArrayMaxSize,ArrayUnique } from 'class-validator';
import { Type } from 'class-transformer';
import { ListDto } from './dto';
import { PublishDemandDto,VersionDto } from './transport.dto';
export class MatchQuery extends ListDto {
 @ApiPropertyOptional() @IsOptional() @Type(()=>Number) @IsNumber({maxDecimalPlaces:3}) @Min(0) @Max(1000000) minQuantity?:number;
 @ApiPropertyOptional() @IsOptional() @Type(()=>Number) @IsNumber({maxDecimalPlaces:3}) @Min(0) @Max(1000000) maxQuantity?:number;
 @ApiPropertyOptional() @IsOptional() @IsISO8601({strict:true}) departureFrom?:string;
 @ApiPropertyOptional() @IsOptional() @IsISO8601({strict:true}) departureTo?:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @Length(1,60) carrierId?:string;
 @ApiPropertyOptional() @IsOptional() @IsIn(['PUBLIC','DIRECTED']) publicationMode?:string;
 @ApiPropertyOptional() @IsOptional() @IsIn(['mine','all','owned']) scope?:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,60) grainId?:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,60) modeId?:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,100) origin?:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,100) destination?:string;
}
export class MatchPublishDto extends PublishDemandDto {
 @ApiProperty() @IsString() @Length(1,60) demandId!:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @Length(1,60) planRunId?:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @Length(1,60) supplyId?:string;
 @ApiPropertyOptional() @IsOptional() @IsBoolean() riskAcknowledged?:boolean;
}
export class MatchInviteDto extends VersionDto {
 @ApiProperty({type:[String]}) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ArrayUnique() @IsString({each:true}) @Length(1,60,{each:true}) carrierIds!:string[];
 @ApiPropertyOptional() @IsOptional() @IsString() @Length(1,60) supplyId?:string;
}
export class QuoteTermsDto {
 @ApiProperty() @IsNumber({maxDecimalPlaces:3}) @Min(.001) @Max(1000000) quantity!:number;
 @ApiProperty() @IsNumber({maxDecimalPlaces:2}) @Min(.01) @Max(20000000) price!:number;
 @ApiProperty() @IsIn(['TOTAL','PER_TON']) unit!:string;
 @ApiProperty() @IsBoolean() taxIncluded!:boolean;
 @ApiProperty() @IsISO8601({strict:true}) departureAt!:string;
 @ApiProperty() @IsISO8601({strict:true}) arrivalAt!:string;
 @ApiProperty() @IsISO8601({strict:true}) validUntil!:string;
 @ApiProperty() @IsString() @Length(2,500) capability!:string;
 @ApiProperty() @IsBoolean() followOriginalPlan!:boolean;
 @ApiProperty() @IsString() @Length(0,1000) note!:string;
}
export class QuoteDto {
 @ApiProperty() @IsInt() @Min(1) publicationVersion!:number;
 @ApiProperty() @ValidateNested() @Type(()=>QuoteTermsDto) terms!:QuoteTermsDto;
}
export class NegotiateDto extends VersionDto {
 @ApiProperty() @IsInt() @Min(1) publicationVersion!:number;
 @ApiProperty() @IsIn(['COUNTER','ACCEPT','REJECT','WITHDRAW']) action!:string;
 @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(()=>QuoteTermsDto) terms?:QuoteTermsDto;
 @ApiProperty() @IsString() @Length(0,1000) note!:string;
}
export class ConfirmDto extends VersionDto { @ApiProperty() @IsInt() @Min(1) publicationVersion!:number; }
export class CloseMatchDto extends VersionDto { @ApiProperty() @IsString() @Length(2,500) reason!:string; }
