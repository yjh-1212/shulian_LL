const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const {channelTasks,taskState,overallProgress,stageTime,preparedRoute}=require('../src/channel-data.ts');
const {createTransportModel,disposeTransport}=require('../src/transport-models.ts');
test('channel tasks retain consistent quantities, ordered schedules and continuous rail-sea handoffs',()=>{
 assert.equal(new Set(channelTasks.map(t=>t.id)).size,channelTasks.length);
 assert.equal(channelTasks.filter(t=>taskState(t)==='running').length,6);
 for(const task of channelTasks){assert(task.tons>0);assert(task.current<task.stages.length);assert(task.progress>=0&&task.progress<=1);assert(overallProgress(task)>=0&&overallProgress(task)<=100);let elapsed=0;const routes=[];
  for(const [i,stage] of task.stages.entries()){assert(stage.hours>0);elapsed+=stage.hours;assert(stageTime(task,i));if(stage.route){assert(stage.route.points.length>10);assert(preparedRoute(stage).length>1000);routes.push(stage.route);}}
  for(let i=1;i<routes.length;i++)assert.deepEqual(routes[i-1].points.at(-1),routes[i].points[0],'transshipment must retain the same port position');
  const load=task.stages.find(s=>s.name==='铁路装车');if(load){const cars=parseInt(load.resource);assert(task.tons/cars<=60);}
 }
});
test('three original transport models stay under 2000 triangles each and use no image textures',()=>{
 for(const mode of ['ROAD','RAIL','WATER']){const model=createTransportModel(mode);let triangles=0,meshes=0;model.traverse(mesh=>{if(!mesh.isMesh)return;meshes++;triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])assert.equal(material.map,null);});assert(meshes>5);assert(triangles<2000,`${mode}: ${triangles}`);console.log(`${mode}: ${meshes} meshes, ${triangles} triangles`);disposeTransport(model);}
});
