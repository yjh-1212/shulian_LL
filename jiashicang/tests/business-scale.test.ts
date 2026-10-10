import test from 'node:test';
import assert from 'node:assert/strict';
import {businessScaleSeries,scaleAxis,monthlyChange} from '../src/business-scale';

test('运输量转换为吨，需求保留单数，并按月份对齐',()=>{
 const result=businessScaleSeries([{name:'2026-09',value:2000000},{name:'2026-10',value:3000000}],[{name:'2026-10',first:4,second:3},{name:'2026-08',first:2,second:1}]);
 assert.deepEqual(result,[{name:'2026-08',tonnes:null,demands:2},{name:'2026-09',tonnes:2000,demands:null},{name:'2026-10',tonnes:3000,demands:4}]);
});
test('运输量与需求各用独立刻度，需求轴不出现小数单数',()=>{
 const tonnes=scaleAxis([2000,3800]),demands=scaleAxis([2,4],true);
 assert.ok(tonnes.maximum>=3800);assert.equal(demands.maximum,4);
 assert.ok(demands.ticks.every(Number.isInteger));
 assert.ok(scaleAxis([null,0],true).maximum>0);
});
test('环比保留涨跌，缺少基期或基期为零不生成虚假百分比',()=>{
 assert.equal(monthlyChange([2000,2500]),25);
 assert.equal(monthlyChange([4,3]),-25);
 assert.equal(monthlyChange([4,4]),0);
 assert.equal(monthlyChange([0,4]),null);
 assert.equal(monthlyChange([null,4]),null);
 assert.equal(monthlyChange([4]),null);
});
