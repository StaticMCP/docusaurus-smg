export default class BridgeCompatibilityTester {
    staticMcpPath: string;
    constructor(staticMcpPath: string);
    simulateBridgeUriToPath(uri: string): string;
    simulateBridgeToolToPath(toolName: string, args: Record<string, any>): string;
    testManifest(): Promise<boolean>;
    testResources(): Promise<boolean>;
    testTools(): Promise<boolean>;
    testDirectoryStructure(): Promise<boolean>;
    runAllTests(): Promise<boolean>;
}
