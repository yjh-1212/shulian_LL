import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {knownFixtureVehicle} from '../apps/api/src/business-resource-scope';
const vehicle={id:'car',plate:'辽B8F261'};
const use=(businessId:string,isTestData:boolean)=>({vehicleId:'car',businessId,business:{package:{isTestData}}});
test('known tracking and acceptance registrations are omitted from new dispatch',()=>{
 assert.equal(knownFixtureVehicle(vehicle,[use('tracking-demo-road',true)]),true);
 assert.equal(knownFixtureVehicle({...vehicle,plate:'辽验001'},[use('acceptance-contract',true)]),true);
});
test('a vehicle used by an ordinary contract remains available',()=>{
 assert.equal(knownFixtureVehicle(vehicle,[use('tracking-demo-road',true),use('real-business',false)]),false);
});
test('a historical test task alone does not prove a registration is a fixture',()=>{
 assert.equal(knownFixtureVehicle(vehicle,[use('acceptance-contract',true)]),false);
 assert.equal(knownFixtureVehicle(vehicle,[]),false);
});
