const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('apps/web/src/workbench-greeting.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const scope = { exports: {} };
vm.runInNewContext(code, scope);
const cases = [
  ['00:00:00', '你好'], ['05:59:59', '你好'],
  ['06:00:00', '上午好'], ['10:00:00', '上午好'], ['11:59:59', '上午好'],
  ['12:00:00', '下午好'], ['17:59:59', '下午好'],
  ['18:00:00', '晚上好'], ['23:59:59', '晚上好'],
];
for (const [time, expected] of cases) {
  assert.equal(scope.exports.workbenchGreeting(Date.parse('2026-10-06T' + time + '+08:00')), expected, time);
}
console.log('PASS Beijing greeting at midnight, morning, noon and evening boundaries');
