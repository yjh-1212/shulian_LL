import { Prisma } from '@prisma/client';

// A supply without a time window stays available until its owner pauses or ends it.
export function supplyAvailability(now=new Date()):Prisma.TransportSupplyWhereInput {
  return {AND:[
    {OR:[{validFrom:null},{validFrom:{lte:now}}]},
    {OR:[{validUntil:null},{validUntil:{gt:now}}]},
    {OR:[{serviceEnd:null},{serviceEnd:{gt:now}}]},
  ]};
}
