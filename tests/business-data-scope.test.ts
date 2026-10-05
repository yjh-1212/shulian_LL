import {test} from 'node:test';
import assert from 'node:assert/strict';
import {businessDataScope,testWorkspaceEnabled} from '../apps/api/src/business-data-scope';
test('业务查询默认排除测试记录，开发环境本身不能开启测试工作区',()=>{
 const before={mode:process.env.NODE_ENV,flag:process.env.ENABLE_TEST_WORKSPACE};
 try{
  for(const mode of ['development','test','production']){
   process.env.NODE_ENV=mode;delete process.env.ENABLE_TEST_WORKSPACE;
   assert.deepEqual(businessDataScope(),{isTestData:false});assert.equal(testWorkspaceEnabled(),false);
  }
  process.env.NODE_ENV='development';process.env.ENABLE_TEST_WORKSPACE='true';
  assert.deepEqual(businessDataScope(),{});assert.equal(testWorkspaceEnabled(),true);
  process.env.NODE_ENV='production';
  assert.deepEqual(businessDataScope(),{isTestData:false});assert.equal(testWorkspaceEnabled(),false);
 }finally{
  if(before.mode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=before.mode;
  if(before.flag===undefined)delete process.env.ENABLE_TEST_WORKSPACE;else process.env.ENABLE_TEST_WORKSPACE=before.flag;
 }
});
