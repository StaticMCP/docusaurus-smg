import fs from 'fs/promises';
import path from 'path';

export default class BridgeCompatibilityTester {
  staticMcpPath: string;

  constructor(staticMcpPath: string) {
    this.staticMcpPath = staticMcpPath;
  }

  simulateBridgeUriToPath(uri: string): string {
    if (uri.startsWith("file://")) {
      return `resources/${uri.slice(7)}.json`;
    } else if (uri.includes("://")) {
      const parts = uri.split("://");
      if (parts.length === 2) {
        return `resources/${parts[1]}.json`;
      } else {
        return `${uri}.json`;
      }
    } else if (uri.endsWith(".json")) {
      return uri;
    } else {
      return `${uri}.json`;
    }
  }

  simulateBridgeToolToPath(toolName: string, args: Record<string, any>): string {
    const toolDir = `tools/${toolName}`;
    const argKeys = Object.keys(args);

    if (argKeys.length === 0) {
      return `${toolDir}.json`;
    }

    if (argKeys.length === 1) {
      const argValue = Object.values(args)[0];
      let argStr;
      if (typeof argValue === 'string') {
        argStr = argValue;
      } else if (typeof argValue === 'number' || typeof argValue === 'boolean') {
        argStr = argValue.toString();
      } else {
        argStr = JSON.stringify(argValue);
      }
      return `${toolDir}/${argStr}.json`;
    }

    if (argKeys.length === 2) {
      const values = Object.values(args).map(v => {
        if (typeof v === 'string') return v;
        if (typeof v === 'number' || typeof v === 'boolean') return v.toString();
        return JSON.stringify(v);
      }).sort();
      return `${toolDir}/${values[0]}/${values[1]}.json`;
    }

    const sortedArgs = Object.entries(args)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        let valStr;
        if (typeof v === 'string') valStr = v;
        else if (typeof v === 'number' || typeof v === 'boolean') valStr = v.toString();
        else valStr = JSON.stringify(v);
        return `${k}=${valStr}`;
      })
      .join('&');

    const hash = Buffer.from(sortedArgs).toString('base64')
      .replace(/[/+]/g, '_')
      .replace(/=/g, '');

    return `${toolDir}/${hash}.json`;
  }

  async testManifest(): Promise<boolean> {
    console.log('🧪 Testing manifest compatibility...');
    const manifestPath = path.join(this.staticMcpPath, 'mcp.json');
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      const requiredFields = ['protocolVersion', 'serverInfo', 'capabilities'];
      const missingFields = requiredFields.filter(field => !manifest[field]);
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      if (!manifest.serverInfo.name || !manifest.serverInfo.version) {
        throw new Error('serverInfo must have name and version');
      }
      console.log('✅ Manifest structure is compatible');
      return true;
    } catch (error: any) {
      console.error('❌ Manifest compatibility failed:', error.message);
      return false;
    }
  }

  async testResources(): Promise<boolean> {
    console.log('🧪 Testing resource file compatibility...');
    try {
      const manifestPath = path.join(this.staticMcpPath, 'mcp.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      const resources = manifest.capabilities?.resources || [];
      let compatibleCount = 0;
      let totalCount = resources.length;
      for (const resource of resources.slice(0, 3)) {
        const uri = resource.uri;
        const expectedPath = this.simulateBridgeUriToPath(uri);
        const fullPath = path.join(this.staticMcpPath, expectedPath);
        try {
          const resourceContent = await fs.readFile(fullPath, 'utf-8');
          const resourceData = JSON.parse(resourceContent);
          if (resourceData.contents && Array.isArray(resourceData.contents)) {
            const firstContent = resourceData.contents[0];
            if (firstContent.uri && firstContent.mimeType && firstContent.text) {
              compatibleCount++;
              console.log(`  ✅ ${uri} -> ${expectedPath} (compatible)`);
            } else {
              console.log(`  ⚠️  ${uri} -> ${expectedPath} (missing required fields)`);
            }
          } else {
            console.log(`  ⚠️  ${uri} -> ${expectedPath} (missing contents array)`);
          }
        } catch {
          console.log(`  ❌ ${uri} -> ${expectedPath} (file not found)`);
        }
      }
      const compatibilityRate = totalCount > 0 ? (compatibleCount / Math.min(totalCount, 3)) * 100 : 100;
      console.log(`📊 Resource compatibility: ${compatibilityRate.toFixed(1)}% (${compatibleCount}/${Math.min(totalCount, 3)} tested)`);
      return compatibilityRate >= 80;
    } catch (error: any) {
      console.error('❌ Resource compatibility test failed:', error.message);
      return false;
    }
  }

  async testTools(): Promise<boolean> {
    console.log('🧪 Testing tool file compatibility...');
    try {
      const manifestPath = path.join(this.staticMcpPath, 'mcp.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      const tools = manifest.capabilities?.tools || [];
      let compatibleCount = 0;
      const testCases = [
        { toolName: 'list_docs', args: {} },
        { toolName: 'list_docs', args: { type: 'docs' } },
      ];
      for (const testCase of testCases) {
        const expectedPath = this.simulateBridgeToolToPath(testCase.toolName, testCase.args);
        const fullPath = path.join(this.staticMcpPath, expectedPath);
        try {
          const toolContent = await fs.readFile(fullPath, 'utf-8');
          const toolData = JSON.parse(toolContent);
          if (toolData.content && Array.isArray(toolData.content)) {
            const firstContent = toolData.content[0];
            if (firstContent.type && firstContent.text) {
              compatibleCount++;
              console.log(`  ✅ ${testCase.toolName}(${JSON.stringify(testCase.args)}) -> ${expectedPath}`);
            } else {
              console.log(`  ⚠️  ${testCase.toolName}(${JSON.stringify(testCase.args)}) -> ${expectedPath} (invalid content structure)`);
            }
          } else {
            console.log(`  ⚠️  ${testCase.toolName}(${JSON.stringify(testCase.args)}) -> ${expectedPath} (missing content array)`);
          }
        } catch {
          console.log(`  ❌ ${testCase.toolName}(${JSON.stringify(testCase.args)}) -> ${expectedPath} (file not found)`);
        }
      }
      const compatibilityRate = testCases.length > 0 ? (compatibleCount / testCases.length) * 100 : 100;
      console.log(`📊 Tool compatibility: ${compatibilityRate.toFixed(1)}% (${compatibleCount}/${testCases.length} tested)`);
      return compatibilityRate >= 80;
    } catch (error: any) {
      console.error('❌ Tool compatibility test failed:', error.message);
      return false;
    }
  }

  async testDirectoryStructure(): Promise<boolean> {
    console.log('🧪 Testing directory structure compatibility...');
    try {
      const requiredPaths = [
        'mcp.json',
        'resources',
        'tools'
      ];
      for (const requiredPath of requiredPaths) {
        const fullPath = path.join(this.staticMcpPath, requiredPath);
        try {
          const stat = await fs.stat(fullPath);
          if (requiredPath === 'mcp.json' && !stat.isFile()) {
            throw new Error(`${requiredPath} should be a file`);
          } else if (requiredPath !== 'mcp.json' && !stat.isDirectory()) {
            throw new Error(`${requiredPath} should be a directory`);
          }
          console.log(`  ✅ ${requiredPath} exists`);
        } catch {
          console.log(`  ❌ ${requiredPath} missing or invalid`);
          return false;
        }
      }
      console.log('✅ Directory structure is compatible');
      return true;
    } catch (error: any) {
      console.error('❌ Directory structure test failed:', error.message);
      return false;
    }
  }

  async runAllTests(): Promise<boolean> {
    console.log('\n\n');
    console.log('🔍 StaticMCP Bridge Compatibility Test Suite');
    console.log('=' + '='.repeat(50));
    console.log(`📁 Testing: ${this.staticMcpPath}\n`);
    const results = [];
    results.push(await this.testDirectoryStructure());
    results.push(await this.testManifest());
    results.push(await this.testResources());
    results.push(await this.testTools());
    const passedTests = results.filter(r => r).length;
    const totalTests = results.length;
    console.log('\n' + '='.repeat(51));
    if (passedTests === totalTests) {
      console.log('🎉 All compatibility tests passed!');
      console.log('✅ Your StaticMCP server is fully compatible with the Rust bridge');
    } else {
      console.log(`⚠️  Compatibility test results: ${passedTests}/${totalTests} passed`);
      console.log('❌ Some compatibility issues were found');
      console.log('\n🔧 Recommended actions:');
      console.log('  1. Regenerate your StaticMCP server with the latest generator');
      console.log('  2. Check that all resource and tool files are properly formatted');
      console.log('  3. Verify the directory structure matches the standard');
    }
    if (process.env.CLEAN_OUTPUT === 'TRUE') {
      await fs.rm('./test-output', { recursive: true, force: true });
    }
    return passedTests === totalTests;
  }
}

// CLI usage
if (process.argv[1] === path.resolve(process.argv[1])) {
  (async () => {
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.log(`
Usage: ts-node bridge-test.ts <staticmcp-path>

Test compatibility between a generated StaticMCP server and the Rust bridge.

Examples:
  ts-node bridge-test.ts ./staticmcp-output
  ts-node bridge-test.ts ./my-docs-server
      `);
      process.exit(1);
    }
    const staticMcpPath = args[0];
    const tester = new BridgeCompatibilityTester(staticMcpPath);
    try {
      const allPassed = await tester.runAllTests();
      process.exit(allPassed ? 0 : 1);
    } catch (error: any) {
      console.error('💥 Test suite failed:', error.message);
      process.exit(1);
    }
  })();
}