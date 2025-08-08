# StaticMCP Generator for Docusaurus

A tool to generate StaticMCP files from Docusaurus documentation projects, enabling AI assistants to access and search your documentation content through the Model Context Protocol (MCP).

## Features

- 🚀 **Easy Setup**: Convert any Docusaurus project to a StaticMCP server with one command
- 📖 **Full Content Access**: Extracts all markdown content, frontmatter, and metadata
- 🔍 **Built-in Search**: Includes search and listing tools for AI assistants
- 🎯 **Compliant**: Follows StaticMCP Standard v0.1 specification
- 🔄 **Flexible Input**: Works with both source directories and markdown files

## Installation

### As a Global CLI Tool

```bash
npm install -g docusaurus-smg
```

### As a Project Dependency

```bash
npm install docusaurus-smg
# or
yarn add docusaurus-smg
```

## Quick Start

### Command Line Usage

```bash
# Generate from Docusaurus source directory
docusaurus-smg ./my-docusaurus-site

# Specify output directory and custom options
docusaurus-smg ./docs --output ./mcp-server --name "My Documentation API"

# Generate with custom base URI
docusaurus-smg ./my-site --base-uri "knowledge" --version "2.0.0"
```

### Programmatic Usage

```javascript
const StaticMCPGenerator = require('docusaurus-smg');

const generator = new StaticMCPGenerator({
  outputDir: './my-mcp-server',
  serverName: 'My Custom Docs Server',
  serverVersion: '1.0.0',
  baseUri: 'docs'
});

await generator.generate('./my-docusaurus-project');
console.log('StaticMCP server generated!');
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--output <dir>` | Output directory for the StaticMCP server | `./staticmcp-output` |
| `--name <name>` | Human-readable server name | `"Docusaurus StaticMCP Server"` |
| `--version <version>` | Server version | `"1.0.0"` |
| `--base-uri <uri>` | Base URI for resources | `"docs"` |

## Generated Structure

The tool generates a complete StaticMCP server with this structure:

```
staticmcp-output/
  ├── mcp.json                      # Main manifest file
  ├── resources/                    # Resource files
  │     ├── getting-started.json    # Individual markdown resources
  │     ├── api_reference.json
  │     └── ...
  └── tools/                        # Tool response files
        └── list_docs/
              ├── all.json
              ├── docs.json
              └── blog.json
```

## Available Resources and Tools

### Resources

Each markdown file in your Docusaurus project becomes a resource:

- **URI Format**: `docs://path/to/file` (without .md extension)
- **Content**: Full markdown content with frontmatter metadata
- **MIME Type**: `text/markdown`

### Built-in Tools

#### 1. List Documentation (`list_docs`)

List available documentation:

```json
{
  "name": "list_docs", 
  "description": "List available documentation",
  "parameters": {
    "type": "string (optional) - docs|blog|all"
  }
}
```

## Configuration Options

### Constructor Options

```javascript
const generator = new StaticMCPGenerator({
  outputDir: './output',           // Output directory
  serverName: 'My Server',         // Server name in manifest
  serverVersion: '1.0.0',          // Server version
  protocolVersion: '2024-11-05',   // MCP protocol version
  baseUri: 'docs'                  // Base URI for resources
});
```

## Examples

### Basic Docusaurus Site

```bash
# Clone a sample Docusaurus site
git clone https://github.com/facebook/docusaurus.git
cd docusaurus/website

# Generate StaticMCP server
docusaurus-smg . --output ./mcp-server --name "Docusaurus Docs"
```

### Custom Documentation Structure

```bash
# For a custom docs folder structure
docusaurus-smg ./my-docs --base-uri "knowledge" --name "Knowledge Base"
```

### Multiple Documentation Types

The generator automatically detects and processes:

- **docs/**: Main documentation (mapped to `docs://` URIs)
- **blog/**: Blog posts (mapped to `blog://` URIs)
- Any other markdown files in the project

## Integration with AI Assistants

Once generated, your StaticMCP server can be used with any MCP-compatible AI assistant:

1. **Deploy the server** to a web server or CDN
2. **Configure your AI assistant** to connect to the StaticMCP server (through a [bridge](https://staticmcp.com/docs/bridge))
3. **Start asking questions** about your documentation!

## Supported Input Formats

### Docusaurus Source Directory

- Detects `docusaurus.config.js` or `docusaurus.config.ts`
- Processes `docs/`, `blog/`, and `src/pages` directories
- Extracts frontmatter and content from `.md` and `.mdx` files

### Standalone Markdown Directory

- Processes any directory containing markdown files
- Recursively scans subdirectories
- Maintains directory structure in resource URIs

### Frontmatter Support

The generator extracts and preserves frontmatter:

```markdown
---
title: Getting Started
description: Learn how to get started with our platform
tags: [tutorial, beginner]
---

# Getting Started

Your content here...
```

This metadata becomes available in the resource response.

## Error Handling

- **Missing directories**: Gracefully skips missing `docs/` or `blog/` folders
- **Invalid markdown**: Continues processing other files if one fails
- **Permission issues**: Error messages for file system problems
