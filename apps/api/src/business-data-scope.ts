// Fixtures are an explicit development opt-in. The runtime environment alone
// never makes test records part of the operational workspace.
export function testWorkspaceEnabled(){
 return process.env.NODE_ENV!=='production'&&process.env.ENABLE_TEST_WORKSPACE==='true';
}
export function businessDataScope():{isTestData?:false}{
 return testWorkspaceEnabled()?{}:{isTestData:false};
}

// Legacy data-service fixtures predate the isTestData flag. Keep their history
// available in the explicit test workspace, outside normal product and service lists.
export function dataProductScope(){
 if(testWorkspaceEnabled())return {};
 return {NOT:{OR:[
  {AND:[{code:{startsWith:'p8-'}},{name:{startsWith:'Phase8 指标产品'}}]},
  {AND:[{code:{startsWith:'browser-'}},{name:'浏览器验收指标目录'}]},
 ]}};
}
