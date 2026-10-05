import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapRuntime } from '../apps/web/src/map-runtime';
const config = { key: 'test-key', serviceHost: '/_AMapService' };
const deferred = <T>() => { let resolve!: (value:T)=>void, reject!: (cause:unknown)=>void; const promise = new Promise<T>((yes,no)=>{resolve=yes;reject=no;}); return {promise,resolve,reject}; };

test('parallel maps and later route visits share config and SDK, controls stay lazy', async () => {
  let configs=0,scripts=0,plugins=0;
  const api:any={Map:class {}}, sdk=deferred<any>();
  const runtime=createMapRuntime({fetchConfig:async()=>{configs++;return config;},loadSdk:()=>{scripts++;return sdk.promise;},loadPlugins:async(_,names)=>{plugins++;for(const name of names)api[name.split('.').at(-1)!]=class {};}});
  const first=runtime.load(), second=runtime.load();
  await Promise.resolve(); await Promise.resolve(); sdk.resolve(api);
  assert.equal(await first,api); assert.equal(await second,api); assert.equal(await runtime.load(),api);
  assert.deepEqual([configs,scripts,plugins],[1,1,0]);
  await Promise.all([runtime.plugins(api,['AMap.Scale','AMap.ToolBar']),runtime.plugins(api,['AMap.ToolBar','AMap.Scale'])]);
  await runtime.plugins(api,['AMap.Scale','AMap.ToolBar']);
  assert.equal(plugins,1);
});

test('proxy configuration renews before the ticket expires without reloading SDK', async () => {
  let time=0,configs=0,scripts=0;
  const api={Map:class {}};
  const runtime=createMapRuntime({now:()=>time,configTtlMs:100,fetchConfig:async()=>{configs++;return config;},loadSdk:async()=>{scripts++;return api;},loadPlugins:async()=>{}});
  await runtime.load(); time=99;await runtime.load();assert.equal(configs,1);
  time=100;await Promise.all([runtime.load(),runtime.configure()]);
  assert.deepEqual([configs,scripts],[2,1]);
});

test('config and SDK failures can be retried', async () => {
  let configs=0,scripts=0;
  const runtime=createMapRuntime({fetchConfig:async()=>{if(++configs===1)throw Error('config offline');return config;},loadSdk:async()=>{if(++scripts===1)throw Error('sdk offline');return {Map:class {}};},loadPlugins:async()=>{}});
  await assert.rejects(runtime.load(),/config offline/);
  await assert.rejects(runtime.load(),/sdk offline/);
  assert.ok((await runtime.load()).Map);
  assert.deepEqual([configs,scripts],[2,2]);
});

test('a slow SDK returns a timeout, then retry shares the pending download', async () => {
  let scripts=0;
  const sdk=deferred<any>(),api={Map:class {}};
  const runtime=createMapRuntime({timeoutMs:15,fetchConfig:async()=>config,loadSdk:()=>{scripts++;return sdk.promise;},loadPlugins:async()=>{}});
  await assert.rejects(runtime.load(),/地图加载超时/);
  const retry=runtime.load();sdk.resolve(api);
  assert.equal(await retry,api);assert.equal(scripts,1);
});

test('account changes discard old configuration and require a new authorized request', async () => {
  let configs=0,scripts=0;
  const old=deferred<typeof config>();
  const runtime=createMapRuntime({fetchConfig:()=>{configs++;return configs===1?old.promise:Promise.resolve(config);},loadSdk:async()=>{scripts++;return {Map:class {}};},loadPlugins:async()=>{}});
  const first=runtime.load();runtime.invalidate();old.resolve(config);
  await assert.rejects(first,/会话已变更/);
  await runtime.load();assert.deepEqual([configs,scripts],[2,1]);
  runtime.invalidate();await runtime.load();assert.deepEqual([configs,scripts],[3,1]);
});

test('plugin failure is retriable and does not invalidate the usable map SDK', async () => {
  let plugins=0,scripts=0;const api:any={Map:class {}};
  const runtime=createMapRuntime({fetchConfig:async()=>config,loadSdk:async()=>{scripts++;return api;},loadPlugins:async()=>{if(++plugins===1)throw Error('control offline');api.Scale=class {};}});
  await runtime.load();await assert.rejects(runtime.plugins(api,['AMap.Scale']),/control offline/);
  await runtime.plugins(api,['AMap.Scale']);await runtime.load();assert.deepEqual([scripts,plugins],[1,2]);
});
