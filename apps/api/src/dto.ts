import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Length, Matches, IsIn, IsOptional, IsArray, ArrayUnique, ArrayMinSize, ArrayMaxSize, IsBoolean, IsInt, Min, Max, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';
export class LoginDto {
  @ApiProperty() @IsString() @Length(2,64) username!: string;
  @ApiProperty() @IsString() @Length(1,72) password!: string;
}
export class PasswordDto {
  @ApiProperty() @IsString() @Length(1,72) currentPassword!: string;
  @ApiProperty() @IsString() @Length(12,72) @Matches(/^(?=.*[a-zA-Z])(?=.*\d).+$/, {message:'新密码至少12位，且包含字母和数字'}) newPassword!: string;
}
export class ResetPasswordDto {
  @ApiProperty() @IsString() @Length(12,72) @Matches(/^(?=.*[a-zA-Z])(?=.*\d).+$/) newPassword!: string;
}
export class ListDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,100) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,40) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,50) type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,60) businessEntityId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(()=>Number) @IsInt() @Min(1) page: number = 1;
  @ApiPropertyOptional() @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) pageSize: number = 20;
  @ApiPropertyOptional() @IsOptional() @IsIn(['asc','desc']) order: 'asc'|'desc' = 'desc';
}
export class UserDto {
  @ApiProperty() @IsString() @Matches(/^[a-zA-Z0-9_.-]{2,40}$/) username!: string;
  @ApiProperty() @IsString() @Length(1,40) displayName!: string;
  @ApiProperty() @IsString() @Length(1,60) businessEntityId!: string;
  @ApiProperty() @IsArray() @ArrayUnique() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({each:true}) roleIds!: string[];
  @ApiProperty() @IsIn(['ACTIVE','DISABLED']) status!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(12,72) @Matches(/^(?=.*[a-zA-Z])(?=.*\d).+$/) password?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,100) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,60) department?: string;
}
export class EntityDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,100) registeredRegion?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^$|^\d{6}\/\d{6}$/) registeredCodes?:string;
  @ApiProperty() @IsString() @Length(2,100) name!: string;
  @ApiProperty() @IsIn(['TRADER','CARRIER','PLATFORM']) type!: string;
  @ApiProperty() @IsIn(['ACTIVE','DISABLED']) status!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,40) contact?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,30) phone?: string;
}
export class RoleDto {
  @ApiProperty() @IsString() @Length(2,50) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,200) description?: string;
  @ApiProperty() @IsArray() @ArrayUnique() @ArrayMaxSize(100) @IsString({each:true}) permissionIds!: string[];
}
export class DictionaryDto {
  @ApiProperty() @IsString() @Length(1,40) group!: string;
  @ApiProperty() @IsString() @Length(1,40) code!: string;
  @ApiProperty() @IsString() @Length(1,60) label!: string;
  @ApiProperty() @IsInt() @Min(0) @Max(9999) sort!: number;
  @ApiProperty() @IsBoolean() enabled!: boolean;
}
