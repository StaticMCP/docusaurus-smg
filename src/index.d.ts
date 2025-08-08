#!/usr/bin/env node
interface StaticMCPOptions {
    outputDir?: string;
    serverName?: string;
    serverVersion?: string;
    protocolVersion?: string;
    baseUri?: string;
    [key: string]: any;
}
interface Resource {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}
interface Tool {
    name: string;
    description: string;
    inputSchema: object;
}
interface ParsedMatter {
    data: Record<string, any>;
    content: string;
}
declare class StaticMCPGenerator {
    options: StaticMCPOptions;
    resources: Resource[];
    tools: Tool[];
    constructor(options?: StaticMCPOptions);
    /**
     * Parse frontmatter from markdown content
     * Supports both YAML (---) and JSON ({}) frontmatter
     */
    parseFrontmatter(content: string): ParsedMatter;
    /**
     * Simple YAML parser for basic frontmatter
     * Handles strings, numbers, booleans, and arrays
     */
    parseYaml(yamlContent: string): Record<string, any>;
    /**
     * Parse multiline YAML values (arrays, literal blocks, etc.)
     */
    parseMultilineValue(lines: string[], startIndex: number): {
        value: any;
        lastIndex: number;
    };
    generate(inputPath: string): Promise<void>;
    isDocusaurusSource(inputPath: string): Promise<boolean>;
    processSourceDirectory(inputPath: string): Promise<void>;
    processMarkdownDirectory(dirPath: string, type: string): Promise<void>;
    getMarkdownFiles(dirPath: string): Promise<string[]>;
    processMarkdownFile(filePath: string, type: string): Promise<void>;
    saveResourceContent(uri: string, frontmatter: any, content: string): Promise<void>;
    encodeUriForFilename(uri: string): string;
    generateListTool(): Tool;
    generateManifest(): Promise<void>;
    createToolsDirectory(): Promise<void>;
    createSampleToolResponses(toolDir: string, tool: Tool): Promise<void>;
    createBridgeCompatiblePaths(toolDir: string, toolName: string, params: any, response: any): Promise<void>;
    generateSampleParams(tool: Tool): any[];
    hashParams(params: any): string;
    generateToolResponse(toolName: string, params: any): any;
    cleanOutputDir(): Promise<void>;
}
export default StaticMCPGenerator;
