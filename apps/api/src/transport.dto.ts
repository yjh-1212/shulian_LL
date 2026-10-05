import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString,Length,IsArray,ArrayUnique,ArrayMaxSize,ArrayMinSize,IsNumber,Min,Max,IsBoolean,IsIn,IsInt,IsOptional,IsISO8601,ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ListDto } from './dto';
import { PointDto } from './planning.dto';
export class TransportQuery extends ListDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,60) grainId?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,60) modeId?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,80) origin?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,80) destination?:string;
}
export class VersionDto {
  @ApiProperty() @IsInt() @Min(1) version!:number;
}
export class DemandDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1,60) orderItemId?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1,60) grainId?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1,100) cargoName?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1,100) specification?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2,100) name?:string;
  @ApiProperty() @IsNumber({maxDecimalPlaces:3}) @Min(0.001) @Max(1000000) quantity!:number;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMinSize(3) @ArrayMaxSize(3) @IsString({each:true}) originCodes?:string[];
  @ApiProperty() @IsString() @Length(2,200) originAddress!:string;
  @ApiPropertyOptional({type:PointDto}) @IsOptional() @ValidateNested() @Type(()=>PointDto) originPoint?:PointDto|null;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMinSize(3) @ArrayMaxSize(3) @IsString({each:true}) destinationCodes?:string[];
  @ApiProperty() @IsString() @Length(2,200) destinationAddress!:string;
  @ApiPropertyOptional({type:PointDto}) @IsOptional() @ValidateNested() @Type(()=>PointDto) destinationPoint?:PointDto|null;
  @ApiProperty() @IsISO8601({strict:true}) departureAt!:string;
  @ApiProperty() @IsISO8601({strict:true}) arrivalAt!:string;
  @ApiProperty() @IsArray() @ArrayUnique() @ArrayMaxSize(4) @IsString({each:true}) modeIds!:string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowMultimodal?:boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowTransfer?:boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10) maxTransfers?:number;
  @ApiProperty() @IsIn(['BULK','CONTAINER']) loadingType!:string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['BALANCED','COST','TIME']) preference?:string;
  @ApiPropertyOptional() @IsOptional() @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(20000000) budget?:number;
  @ApiProperty() @IsString() @Length(1,40) contact!:string;
  @ApiProperty() @IsString() @Length(6,30) phone!:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,2000) notes?:string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) version?:number;
}
export class PublishDemandDto extends VersionDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowPartial?:boolean;
  @ApiProperty() @IsIn(['PUBLIC','DIRECTED']) mode!:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1,60) targetCarrierId?:string;
  @ApiPropertyOptional({type:[String]}) @IsOptional() @IsArray() @ArrayUnique() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({each:true}) @Length(1,60,{each:true}) targetCarrierIds?:string[];
  @ApiProperty() @IsISO8601({strict:true}) deadline!:string;
  @ApiProperty() @IsIn(['TOTAL','PER_TON']) quoteType!:string;
  @ApiProperty() @IsBoolean() budgetPublic!:boolean;
  @ApiProperty() @IsBoolean() contactPublic!:boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,1000) notes?:string;
}
export class SupplyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2,100) name?:string;
  @ApiProperty() @IsString() @Length(1,60) modeId!:string;
  @ApiProperty() @IsArray() @ArrayMinSize(2) @ArrayMaxSize(3) @IsString({each:true}) originCodes!:string[];
  @ApiProperty() @IsArray() @ArrayMinSize(2) @ArrayMaxSize(3) @IsString({each:true}) destinationCodes!:string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2,200) originAddress?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2,200) destinationAddress?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,500) viaNodes?:string;
  @ApiPropertyOptional() @IsOptional() @IsNumber({maxDecimalPlaces:3}) @Min(.001) @Max(1000000) capacity?:number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({maxDecimalPlaces:3}) @Min(.001) @Max(1000000) minQuantity?:number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({maxDecimalPlaces:3}) @Min(.001) @Max(1000000) maxQuantity?:number;
  @ApiPropertyOptional() @IsOptional() @IsIn(['VEHICLE','RAIL','VESSEL','CONTAINER','COMBINED']) resourceType?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,500) resourceDescription?:string;
  @ApiProperty() @IsArray() @ArrayUnique() @ArrayMaxSize(30) @IsString({each:true}) grainIds!:string[];
  @ApiPropertyOptional() @IsOptional() @IsIn(['BULK','CONTAINER']) loadingType?:string;
  @ApiPropertyOptional() @IsOptional() @IsNumber({maxDecimalPlaces:2}) @Min(.01) @Max(20000000) bulkPrice?:number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({maxDecimalPlaces:2}) @Min(.01) @Max(20000000) container20Price?:number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({maxDecimalPlaces:2}) @Min(.01) @Max(20000000) container40Price?:number;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({strict:true}) serviceStart?:string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({strict:true}) serviceEnd?:string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(10000) durationHours?:number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(20000000) referencePrice?:number;
  @ApiPropertyOptional() @IsOptional() @IsIn(['PER_TON','PER_VEHICLE','PER_CONTAINER','TOTAL']) priceUnit?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,300) capabilities?:string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({strict:true}) validFrom?:string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({strict:true}) validUntil?:string;
  @ApiProperty() @IsString() @Length(1,40) contact!:string;
  @ApiProperty() @IsString() @Length(6,30) phone!:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,2000) notes?:string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) version?:number;
}
export class OrderItemDto {
  @ApiProperty() @IsString() @Length(1,30) lineNo!:string;
  @ApiProperty() @IsString() @Length(1,60) grainId!:string;
  @ApiProperty() @IsString() @Length(1,100) cargoName!:string;
  @ApiProperty() @IsString() @Length(1,100) specification!:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1,30) grainGrade?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2,200) pickupAddress?:string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMinSize(3) @ArrayMaxSize(3) @IsString({each:true}) pickupCodes?:string[];
  @ApiProperty() @IsNumber({maxDecimalPlaces:3}) @Min(.001) @Max(1000000) quantity!:number;
}
export class ImportOrderDto {
  @ApiProperty() @IsString() @Length(2,60) businessNo!:string;
  @ApiProperty() @IsString() @Length(1,60) businessEntityId!:string;
  @ApiProperty() @IsString() @Length(2,100) recipient!:string;
  @ApiProperty() @IsString() @Length(1,40) shipperContact!:string;
  @ApiProperty() @IsString() @Length(6,30) shipperPhone!:string;
  @ApiProperty() @IsString() @Length(1,40) recipientContact!:string;
  @ApiProperty() @IsString() @Length(6,30) recipientPhone!:string;
  @ApiProperty() @IsString() @Length(1,80) sourceSystem!:string;
  @ApiProperty() @IsString() @Length(1,80) sourceRecordId!:string;
  @ApiProperty({type:[OrderItemDto]}) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>OrderItemDto) items!:OrderItemDto[];
}
