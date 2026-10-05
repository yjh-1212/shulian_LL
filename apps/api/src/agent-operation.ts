import {ConflictException} from '@nestjs/common';
export function checkAgentOperation(signal?:AbortSignal){
 if(signal?.aborted)throw new ConflictException('本次分析已停止，输入条件已保留');
}
export function agentSignal(signal:AbortSignal|undefined,timeout:number){
 return signal?AbortSignal.any([signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout);
}
