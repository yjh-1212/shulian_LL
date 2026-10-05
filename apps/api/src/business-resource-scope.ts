import {testWorkspaceEnabled} from './business-data-scope';

// FleetVehicle has no archive flag. Keep historical task references intact,
// and omit only registrations with explicit fixture evidence from new dispatch.
export function knownFixtureVehicle(vehicle:any,uses:any[]){
 const own=uses.filter(t=>t.vehicleId===vehicle.id);
 if(!own.some(t=>t.business?.package?.isTestData)||own.some(t=>t.business?.package?.isTestData===false))return false;
 return /^辽(?:验|演示)/.test(vehicle.plate)||own.some(t=>t.business?.package?.isTestData&&t.businessId?.startsWith('tracking-demo-'));
}
export async function selectableVehicles(db:any,carrierId:string){
 const vehicles=await db.fleetVehicle.findMany({where:{carrierId}});
 if(testWorkspaceEnabled()||!vehicles.length)return vehicles;
 const uses=await db.transportTask.findMany({where:{vehicleId:{in:vehicles.map((v:any)=>v.id)}},select:{vehicleId:true,businessId:true,business:{select:{package:{select:{isTestData:true}}}}}});
 return vehicles.filter((v:any)=>!knownFixtureVehicle(v,uses));
}
