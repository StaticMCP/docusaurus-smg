#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { realpathSync } from 'fs';
import { fileURLToPath } from 'url';
class StaticMCPGenerator {
    options;
    resources;
    tools;
    constructor(options = {}) {
        this.options = {
            outputDir: options.outputDir || './staticmcp',
            serverName: options.serverName || 'Docusaurus StaticMCP Server',
            serverVersion: options.serverVersion || '1.0.0',
            protocolVersion: options.protocolVersion || '2024-11-05',
            baseUri: options.baseUri || 'docs',
            ...options
        };
        this.resources = [];
        this.tools = [];
    }
    parseFrontmatter(content) {
        const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
        if (yamlMatch) {
            return { data: this.parseYaml(yamlMatch[1]), content: yamlMatch[2] };
        }
        const jsonMatch = content.match(/^{\s*\n([\s\S]*?)\n}\s*\n([\s\S]*)$/);
        if (jsonMatch) {
            try {
                return { data: JSON.parse(`{${jsonMatch[1]}}`), content: jsonMatch[2] };
            }
            catch {
                console.warn('Failed to parse JSON frontmatter, treating as regular content');
            }
        }
        return { data: {}, content };
    }
    parseYaml(yamlContent) {
        const result = {};
        const lines = yamlContent.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('#'))
                continue;
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1)
                continue;
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            if (value === '' || value === '|' || value === '>') {
                const multilineValue = this.parseMultilineValue(lines, i);
                result[key] = multilineValue.value;
                i = multilineValue.lastIndex;
                continue;
            }
            if (value.startsWith('[') && value.endsWith(']')) {
                try {
                    result[key] = JSON.parse(value);
                    continue;
                }
                catch { }
            }
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                result[key] = value.slice(1, -1);
            }
            else if (value === 'true') {
                result[key] = true;
            }
            else if (value === 'false') {
                result[key] = false;
            }
            else if (!isNaN(Number(value)) && value !== '') {
                result[key] = Number(value);
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
    parseMultilineValue(lines, startIndex) {
        const startLine = lines[startIndex];
        let value = startLine.substring(startLine.indexOf(':') + 1).trim();
        let baseIndent = 0;
        for (let i = startIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '')
                continue;
            baseIndent = line.length - line.trimStart().length;
            break;
        }
        const values = [];
        let i = startIndex + 1;
        if (value === '|') {
            for (; i < lines.length; i++) {
                const line = lines[i];
                if (line.trim() === '') {
                    values.push('');
                    continue;
                }
                const indent = line.length - line.trimStart().length;
                if (indent < baseIndent && line.trim() !== '') {
                    i--;
                    break;
                }
                values.push(line.substring(baseIndent));
            }
            return { value: values.join('\n'), lastIndex: i };
        }
        if (value === '>') {
            for (; i < lines.length; i++) {
                const line = lines[i];
                if (line.trim() === '')
                    continue;
                const indent = line.length - line.trimStart().length;
                if (indent < baseIndent && line.trim() !== '') {
                    i--;
                    break;
                }
                values.push(line.trim());
            }
            return { value: values.join(' '), lastIndex: i };
        }
        for (; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '')
                continue;
            const indent = line.length - line.trimStart().length;
            if (indent < baseIndent && line.trim() !== '') {
                i--;
                break;
            }
            const trimmed = line.trim();
            if (trimmed.startsWith('- ')) {
                values.push(trimmed.substring(2));
            }
            else if (indent >= baseIndent && values.length > 0) {
                values[values.length - 1] += ' ' + trimmed;
            }
            else {
                i--;
                break;
            }
        }
        return { value: values, lastIndex: i };
    }
    async generate(inputPath) {
        console.log(`Generating StaticMCP server from: ${inputPath}`);
        await this.cleanOutputDir();
        if (!await this.isDocusaurusSource(inputPath)) {
            throw new Error('Not a Docusaurus source directory (missing docusaurus.config.js or docusaurus.config.ts)');
        }
        await this.processSourceDirectory(inputPath);
        await this.generateManifest();
        console.log(`StaticMCP server generated at: ${this.options.outputDir}`);
    }
    async isDocusaurusSource(inputPath) {
        const configFiles = ['docusaurus.config.js', 'docusaurus.config.ts'];
        for (const configFile of configFiles) {
            try {
                await fs.access(path.join(inputPath, configFile));
                return true;
            }
            catch { }
        }
        return false;
    }
    async processSourceDirectory(inputPath) {
        console.log('Processing Docusaurus source directory...');
        const paths = [
            { dir: path.join(inputPath, 'docs'), type: 'docs' },
            { dir: path.join(inputPath, 'blog'), type: 'blog' },
            { dir: path.join(inputPath, 'src', 'pages'), type: 'pages' }
        ];
        for (const { dir, type } of paths) {
            try {
                await fs.access(dir);
                await this.processMarkdownDirectory(dir, type, inputPath);
            }
            catch { }
        }
    }
    async processMarkdownDirectory(dirPath, type, inputPath) {
        const files = await this.getMarkdownFiles(dirPath);
        for (const filePath of files) {
            await this.processMarkdownFile(filePath, type, inputPath);
        }
    }
    async getMarkdownFiles(dirPath) {
        const files = [];
        const scan = async (currentPath) => {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    await scan(fullPath);
                }
                else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
                    files.push(fullPath);
                }
            }
        };
        await scan(dirPath);
        return files;
    }
    async processMarkdownFile(filePath, type, inputPath) {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = this.parseFrontmatter(content);
        const relativePath = path.relative(inputPath, filePath);
        const uriPath = relativePath.replace(/\.(md|mdx)$/, '').replace(/\\/g, '/');
        const uri = `${this.options.baseUri}://${uriPath}`;
        const resource = {
            uri,
            name: parsed.data.title || path.basename(filePath, path.extname(filePath)),
            description: parsed.data.description || `${type} content: ${parsed.data.title || 'Untitled'}`,
            mimeType: 'text/markdown',
            content: parsed.content,
            metadata: parsed.data
        };
        this.resources.push(resource);
        await this.saveResourceContent(uri, parsed.data, parsed.content);
    }
    async saveResourceContent(uri, frontmatter, content) {
        const resourcesDir = path.join(this.options.outputDir, 'resources');
        const filename = this.encodeUriForFilename(uri);
        const filePath = path.join(resourcesDir, `${filename}.json`);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const resourceResponse = {
            contents: [{
                    uri,
                    mimeType: 'text/markdown',
                    text: content
                }]
        };
        if (Object.keys(frontmatter).length > 0) {
            resourceResponse.contents[0].metadata = frontmatter;
        }
        await fs.writeFile(filePath, JSON.stringify(resourceResponse, null, 2));
    }
    encodeUriForFilename(uri) {
        if (uri.includes('://')) {
            const parts = uri.split('://');
            if (parts.length === 2) {
                return parts[1].replace(/[*?"<>|]/g, '_');
            }
        }
        return uri.replace(/[*?"<>|]/g, '_');
    }
    generateResourceTools() {
        return [
            {
                name: 'list_resources',
                description: 'List all available resource URIs that can be used with get_resource',
                inputSchema: { type: 'object', properties: {} }
            },
            {
                name: 'get_resource',
                description: 'Get the content of a specific resource by URI',
                inputSchema: {
                    type: 'object',
                    properties: {
                        uri: { type: 'string', description: 'URI of the resource to retrieve' }
                    },
                    required: ['uri']
                }
            }
        ];
    }
    async generateManifest() {
        this.tools.push(...this.generateResourceTools());
        const manifest = {
            protocolVersion: this.options.protocolVersion,
            serverInfo: {
                name: this.options.serverName,
                version: this.options.serverVersion
            },
            capabilities: {
                resources: this.resources.map(r => ({
                    uri: r.uri,
                    name: r.name,
                    description: r.description,
                    mimeType: r.mimeType
                })),
                tools: this.tools
            }
        };
        await fs.writeFile(path.join(this.options.outputDir, 'mcp.json'), JSON.stringify(manifest, null, 2));
        await this.createToolsDirectory();
    }
    async createToolsDirectory() {
        await fs.mkdir(path.join(this.options.outputDir, 'tools'), { recursive: true });
        for (const tool of this.tools) {
            const toolDir = path.join(this.options.outputDir, 'tools', tool.name);
            if (tool.inputSchema.properties.length > 0) {
                await fs.mkdir(toolDir, { recursive: true });
            }
            await this.createSampleToolResponses(toolDir, tool);
        }
    }
    async createSampleToolResponses(toolDir, tool) {
        const sampleParams = this.generateSampleParams(tool);
        for (const params of sampleParams) {
            const response = this.generateToolResponse(tool.name, params);
            await this.createBridgeCompatiblePaths(toolDir, tool.name, params, response);
        }
    }
    async createBridgeCompatiblePaths(toolDir, toolName, params, response) {
        if (Object.keys(params).length === 0) {
            const parentDir = path.dirname(toolDir);
            const bridgePath = path.join(parentDir, `${toolName}.json`);
            await fs.writeFile(bridgePath, JSON.stringify(response, null, 2));
            return;
        }
        if (Object.keys(params).length === 1) {
            const argValue = Object.values(params)[0];
            let argStr = String(argValue);
            if (typeof argValue === 'string' && argValue.includes('://')) {
                const parts = argValue.split('://');
                argStr = parts.length === 2 ? parts[1] : argValue;
            }
            argStr = argStr.replace(/[*?"<>|]/g, '_');
            const bridgePath = path.join(toolDir, `${argStr}.json`);
            await fs.mkdir(path.dirname(bridgePath), { recursive: true });
            await fs.writeFile(bridgePath, JSON.stringify(response, null, 2));
        }
        if (Object.keys(params).length === 2) {
            const values = Object.values(params).map(v => {
                let str = String(v);
                if (typeof v === 'string' && v.includes('://')) {
                    const parts = v.split('://');
                    str = parts.length === 2 ? parts[1] : v;
                }
                return str.replace(/[*?"<>|]/g, '_');
            }).sort();
            const subDir = path.join(toolDir, values[0]);
            await fs.mkdir(subDir, { recursive: true });
            await fs.writeFile(path.join(subDir, `${values[1]}.json`), JSON.stringify(response, null, 2));
        }
    }
    generateSampleParams(tool) {
        if (tool.name === 'list_resources') {
            return [{}];
        }
        if (tool.name === 'get_resource') {
            return this.resources.map(resource => ({ uri: resource.uri }));
        }
        return [];
    }
    generateToolResponse(toolName, params) {
        if (toolName === 'list_resources') {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(this.resources.map(r => this.encodeUriForFilename(r.uri)), null, 2)
                    }]
            };
        }
        if (toolName === 'get_resource') {
            const resource = this.resources.find(r => r.uri === params.uri);
            if (!resource) {
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ error: 'Resource not found' }, null, 2)
                        }]
                };
            }
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            uri: resource.uri,
                            name: resource.name,
                            description: resource.description,
                            mimeType: resource.mimeType,
                            content: resource.content,
                            metadata: resource.metadata
                        }, null, 2)
                    }]
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: 'Tool response not implemented'
                }]
        };
    }
    async cleanOutputDir() {
        try {
            await fs.rm(this.options.outputDir, { recursive: true, force: true });
        }
        catch { }
        await fs.mkdir(this.options.outputDir, { recursive: true });
    }
}
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log(`
Usage: staticmcp-generator <input-path> [options]

Options:
  --output <dir>         Output directory (default: ./staticmcp)
  --name <name>          Server name (default: "Docusaurus StaticMCP Server")
  --version <version>    Server version (default: "1.0.0")
  --base-uri <uri>       Base URI for resources (default: "docs")

Examples:
  staticmcp-generator ./my-docusaurus-site
  staticmcp-generator ./docs --output ./mcp-server --name "My Docs"
    `);
        process.exit(1);
    }
    const inputPath = args[0];
    const options = {};
    for (let i = 1; i < args.length; i += 2) {
        const flag = args[i];
        const value = args[i + 1];
        switch (flag) {
            case '--output':
                options.outputDir = value;
                break;
            case '--name':
                options.serverName = value;
                break;
            case '--version':
                options.serverVersion = value;
                break;
            case '--base-uri':
                options.baseUri = value;
                break;
        }
    }
    try {
        const generator = new StaticMCPGenerator(options);
        await generator.generate(inputPath);
        console.log('✅ StaticMCP server generated successfully!');
    }
    catch (error) {
        console.error('❌ Error generating StaticMCP server:', error.message);
        process.exit(1);
    }
}
export default StaticMCPGenerator;
const scriptPath = realpathSync(process.argv[1]);
const modulePath = fileURLToPath(import.meta.url);
if (scriptPath === modulePath) {
    main();
}
