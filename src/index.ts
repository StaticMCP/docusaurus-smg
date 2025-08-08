#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { realpathSync } from 'fs';
import { fileURLToPath } from 'url';

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

class StaticMCPGenerator {
  options: StaticMCPOptions;
  resources: Resource[];
  tools: Tool[];

  constructor(options: StaticMCPOptions = {}) {
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

  /**
   * Parse frontmatter from markdown content
   * Supports both YAML (---) and JSON ({}) frontmatter
   */
  parseFrontmatter(content: string): ParsedMatter {
    const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (yamlMatch) {
      const yamlContent = yamlMatch[1];
      const markdownContent = yamlMatch[2];
      const data = this.parseYaml(yamlContent);
      return { data, content: markdownContent };
    }

    const jsonMatch = content.match(/^{\s*\n([\s\S]*?)\n}\s*\n([\s\S]*)$/);
    if (jsonMatch) {
      const jsonContent = `{${jsonMatch[1]}}`;
      const markdownContent = jsonMatch[2];
      try {
        const data = JSON.parse(jsonContent);
        return { data, content: markdownContent };
      } catch (error) {
        console.warn('Failed to parse JSON frontmatter, treating as regular content');
      }
    }

    return { data: {}, content };
  }

  /**
   * Simple YAML parser for basic frontmatter
   * Handles strings, numbers, booleans, and arrays
   */
  parseYaml(yamlContent: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = yamlContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      // Handle multiline values or arrays
      if (value === '' || value === '|' || value === '>') {
        const multilineValue = this.parseMultilineValue(lines, i);
        result[key] = multilineValue.value;
        i = multilineValue.lastIndex;
        continue;
      }

      // Handle arrays on single line
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          result[key] = JSON.parse(value);
          continue;
        } catch (error) {
          // Fall through to string parsing
        }
      }

      // Handle quoted strings
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        result[key] = value.slice(1, -1);
        continue;
      }

      // Handle booleans
      if (value === 'true') {
        result[key] = true;
        continue;
      }
      if (value === 'false') {
        result[key] = false;
        continue;
      }

      // Handle numbers
      if (!isNaN(Number(value)) && value !== '') {
        result[key] = Number(value);
        continue;
      }

      // Default to string
      result[key] = value;
    }

    return result;
  }

  /**
   * Parse multiline YAML values (arrays, literal blocks, etc.)
   */
  parseMultilineValue(lines: string[], startIndex: number): { value: any; lastIndex: number } {
    const startLine = lines[startIndex];
    const key = startLine.substring(0, startLine.indexOf(':')).trim();
    let value = startLine.substring(startLine.indexOf(':') + 1).trim();
    
    // Determine the indentation level
    let baseIndent = 0;
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      
      baseIndent = line.length - line.trimStart().length;
      break;
    }

    const values: string[] = [];
    let i = startIndex + 1;
    
    // Handle literal block scalars (|)
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

    // Handle folded block scalars (>)
    if (value === '>') {
      for (; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '') continue;
        
        const indent = line.length - line.trimStart().length;
        if (indent < baseIndent && line.trim() !== '') {
          i--;
          break;
        }
        
        values.push(line.trim());
      }
      return { value: values.join(' '), lastIndex: i };
    }

    // Handle arrays
    for (; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      
      const indent = line.length - line.trimStart().length;
      if (indent < baseIndent && line.trim() !== '') {
        i--;
        break;
      }
      
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        values.push(trimmed.substring(2));
      } else if (indent >= baseIndent) {
        // Continuation of previous value
        if (values.length > 0) {
          values[values.length - 1] += ' ' + trimmed;
        }
      } else {
        i--;
        break;
      }
    }

    return { value: values, lastIndex: i };
  }

  async generate(inputPath: string) {
    console.log(`Generating StaticMCP server from: ${inputPath}`);
    await this.cleanOutputDir();
    const isSourceDir = await this.isDocusaurusSource(inputPath);
    if (!isSourceDir) {
      throw new Error('Not a Docusaurus source directory (missing docusaurus.config.js or docusaurus.config.ts)');
    }
    await this.processSourceDirectory(inputPath);
    await this.generateManifest();
    console.log(`StaticMCP server generated at: ${this.options.outputDir}`);
  }

  async isDocusaurusSource(inputPath: string): Promise<boolean> {
    const configFiles = ['docusaurus.config.js', 'docusaurus.config.ts'];
    for (const configFile of configFiles) {
      try {
        await fs.access(path.join(inputPath, configFile));
        return true;
      } catch {}
    }
    return false;
  }

  async processSourceDirectory(inputPath: string) {
    console.log('Processing Docusaurus source directory...');
    const docsPath = path.join(inputPath, 'docs');
    const blogPath = path.join(inputPath, 'blog');
    const pagesPath = path.join(inputPath, 'src', 'pages');
    try {
      await fs.access(docsPath);
      await this.processMarkdownDirectory(docsPath, 'docs');
    } catch {}
    try {
      await fs.access(blogPath);
      await this.processMarkdownDirectory(blogPath, 'blog');
    } catch {}
    try {
      await fs.access(pagesPath);
      await this.processMarkdownDirectory(pagesPath, 'pages');
    } catch {}
  }

  async processMarkdownDirectory(dirPath: string, type: string) {
    const files = await this.getMarkdownFiles(dirPath);
    for (const filePath of files) {
      await this.processMarkdownFile(filePath, type);
    }
  }

  async getMarkdownFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    async function scan(currentPath: string) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
          files.push(fullPath);
        }
      }
    }
    await scan(dirPath);
    return files;
  }

  async processMarkdownFile(filePath: string, type: string) {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = this.parseFrontmatter(content);
    const relativePath = path.relative(process.cwd(), filePath);
    const uriPath = relativePath
      .replace(/\.(md|mdx)$/, '')
      .replace(/\\/g, '/');
    const uri = `${this.options.baseUri}://${uriPath}`;
    const resource: Resource = {
      uri,
      name: parsed.data.title || path.basename(filePath, path.extname(filePath)),
      description: parsed.data.description || `${type} content: ${parsed.data.title || 'Untitled'}`,
      mimeType: 'text/markdown'
    };
    this.resources.push(resource);
    await this.saveResourceContent(uri, parsed.data, parsed.content);
  }

  async saveResourceContent(uri: string, frontmatter: any, content: string) {
    const resourcesDir = path.join(this.options.outputDir!, 'resources');
    const filename = this.encodeUriForFilename(uri);
    const filePath = path.join(resourcesDir, `${filename}.json`);
    const fileDir = path.dirname(filePath);
    await fs.mkdir(fileDir, { recursive: true });
    const resourceResponse: any = {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: content
        }
      ]
    };
    if (Object.keys(frontmatter).length > 0) {
      resourceResponse.contents[0].metadata = frontmatter;
    }
    await fs.writeFile(filePath, JSON.stringify(resourceResponse, null, 2));
  }

  encodeUriForFilename(uri: string): string {
    if (uri.includes('://')) {
      const parts = uri.split('://');
      if (parts.length === 2) {
        return parts[1].replace(/[*?"<>|]/g, '_');
      }
    }
    return uri.replace(/[*?"<>|]/g, '_');
  }

  generateListTool(): Tool {
    return {
      name: 'list_docs',
      description: 'List available documentation',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['docs', 'blog', 'all'],
            description: 'Type of content to list'
          }
        }
      }
    };
  }

  async generateManifest() {
    this.tools.push(this.generateListTool());
    const manifest = {
      protocolVersion: this.options.protocolVersion,
      serverInfo: {
        name: this.options.serverName,
        version: this.options.serverVersion
      },
      capabilities: {
        resources: this.resources,
        tools: this.tools
      }
    };
    const manifestPath = path.join(this.options.outputDir!, 'mcp.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await this.createToolsDirectory();
  }

  async createToolsDirectory() {
    const toolsDir = path.join(this.options.outputDir!, 'tools');
    for (const tool of this.tools) {
      const toolDir = path.join(toolsDir, tool.name);
      await fs.mkdir(toolDir, { recursive: true });
      await this.createSampleToolResponses(toolDir, tool);
    }
  }

  async createSampleToolResponses(toolDir: string, tool: Tool) {
    const sampleParams = this.generateSampleParams(tool);
    for (const params of sampleParams) {
      const response = this.generateToolResponse(tool.name, params);
      await this.createBridgeCompatiblePaths(toolDir, tool.name, params, response);
    }
  }
  
  async createBridgeCompatiblePaths(toolDir: string, toolName: string, params: any, response: any) {
    if (Object.keys(params).length === 0) {
      const parentDir = path.dirname(toolDir);
      const bridgePath = path.join(parentDir, `${toolName}.json`);
      await fs.writeFile(bridgePath, JSON.stringify(response, null, 2));
      return;
    }
    if (Object.keys(params).length === 1) {
      const argValue = Object.values(params)[0];
      let argStr;
      if (typeof argValue === 'string') {
        argStr = argValue;
      } else if (typeof argValue === 'number' || typeof argValue === 'boolean') {
        argStr = argValue.toString();
      } else {
        argStr = JSON.stringify(argValue);
      }
      const bridgePath = path.join(toolDir, `${argStr}.json`);
      await fs.writeFile(bridgePath, JSON.stringify(response, null, 2));
    }
    if (Object.keys(params).length === 2) {
      const values = Object.values(params).map(v => {
        if (typeof v === 'string') return v;
        if (typeof v === 'number' || typeof v === 'boolean') return v.toString();
        return JSON.stringify(v);
      }).sort();
      const subDir = path.join(toolDir, values[0]);
      await fs.mkdir(subDir, { recursive: true });
      const bridgePath = path.join(subDir, `${values[1]}.json`);
      await fs.writeFile(bridgePath, JSON.stringify(response, null, 2));
    }
  }

  generateSampleParams(tool: Tool): any[] {
    const samples: any[] = [];
    if (tool.name === 'list_docs') {
      samples.push(
        {},
        { type: 'docs' },
        { type: 'blog' },
        { type: 'all' }
      );
    }
    return samples;
  }

  hashParams(params: any): string {
    if (Object.keys(params).length <= 2) {
      const paramString = JSON.stringify(params, Object.keys(params).sort());
      return crypto.createHash('md5').update(paramString).digest('hex').substring(0, 8);
    }
    const sortedArgs = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        let valStr;
        if (typeof v === 'string') valStr = v;
        else if (typeof v === 'number' || typeof v === 'boolean') valStr = v.toString();
        else valStr = JSON.stringify(v);
        return `${k}=${valStr}`;
      })
      .join('&');
    const base64Hash = Buffer.from(sortedArgs).toString('base64')
      .replace(/[/+]/g, '_')
      .replace(/=/g, '');
    return base64Hash.substring(0, 16);
  }

  generateToolResponse(toolName: string, params: any): any {
    if (toolName === 'list_docs') {
      const filteredResources = this.resources.filter(resource => {
        if (!params.type || params.type === 'all') return true;
        return resource.uri.includes(params.type);
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(filteredResources, null, 2)
          }
        ]
      };
    }
    return {
      content: [
        {
          type: 'text',
          text: 'Tool response not implemented'
        }
      ]
    };
  }

  async cleanOutputDir() {
    try {
      await fs.rm(this.options.outputDir!, { recursive: true, force: true });
    } catch {}
    await fs.mkdir(this.options.outputDir!, { recursive: true });
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
  const options: StaticMCPOptions = {};
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
  } catch (error: any) {
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