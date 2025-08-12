declare function createSampleDocusaurusProject(): Promise<string>;
declare function testBasicGeneration(): Promise<void>;
declare function testResourceAccess(): Promise<void>;
declare function testToolResponses(): Promise<void>;
declare function testCustomConfiguration(): Promise<void>;
declare function cleanup(): Promise<void>;
declare function runTests(): Promise<void>;
export { runTests, createSampleDocusaurusProject, testBasicGeneration, testResourceAccess, testToolResponses, testCustomConfiguration, cleanup };
