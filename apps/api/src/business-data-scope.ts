// Fixtures are an explicit development opt-in. The runtime environment alone
// never makes test records part of the operational workspace.
export function testWorkspaceEnabled(){
 return process.env.NODE_ENV!=='production'&&process.env.ENABLE_TEST_WORKSPACE==='true';
}
export function businessDataScope():{isTestData?:false}{
 return testWorkspaceEnabled()?{}:{isTestData:false};
}
