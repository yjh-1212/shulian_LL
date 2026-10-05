import {IsIn,IsString,IsOptional,IsDefined,MinLength,MaxLength,ValidateNested} from 'class-validator';
import {Type} from 'class-transformer';
import {SolveDto} from './planning.dto';
export class CreateAgentConversation {
 @IsIn(['TRACK','ETA','PORT','ENVIRONMENT','DOCUMENT','PLAN']) capability!:string;
 @IsOptional() @IsIn(['page','task','transport-demand','plan','bill','document']) contextType='page';
 @IsOptional() @IsString() @MaxLength(100) contextId='';
}
export class AgentMessageInput {
 @IsString() @MinLength(2) @MaxLength(2000) question!:string;
 @IsString() @MinLength(8) @MaxLength(100) requestKey!:string;
}
export class AgentPlanInput {
 @IsString() @MinLength(8) @MaxLength(100) requestKey!:string;
 @IsDefined() @ValidateNested() @Type(()=>SolveDto) input!:SolveDto;
}
