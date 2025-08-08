import fs from 'fs/promises';
import path from 'path';
import StaticMCPGenerator from '../src/index.js';
async function createSampleDocusaurusProject() {
    const sampleDir = './sample-docusaurus';
    await fs.mkdir(sampleDir, { recursive: true });
    await fs.mkdir(path.join(sampleDir, 'docs'), { recursive: true });
    await fs.mkdir(path.join(sampleDir, 'blog'), { recursive: true });
    const config = `
module.exports = {
  title: 'My Site',
  tagline: 'A sample Docusaurus site',
  url: 'https://mysite.com',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'myorg',
  projectName: 'mysite',
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
        },
        blog: {
          showReadingTime: true,
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};
  `;
    await fs.writeFile(path.join(sampleDir, 'docusaurus.config.js'), config);
    const docs = [
        {
            filename: 'getting-started.md',
            content: `---
title: Getting Started
description: Learn how to get started with our platform
sidebar_position: 1
---

# Getting Started

Welcome to our documentation! This guide will help you get started quickly.

## Installation

Run the following command:

\`\`\`bash
npm install our-package
\`\`\`

## Configuration

Create a config file:

\`\`\`json
{
  "apiKey": "your-api-key",
  "baseUrl": "https://api.example.com"
}
\`\`\`
`
        },
        {
            filename: 'api/authentication.md',
            content: `---
title: Authentication
description: How to authenticate with our API
---

# Authentication

Our API uses API key authentication.

## API Keys

Generate an API key from your dashboard.

## Usage

Include the API key in your requests:

\`\`\`javascript
const response = await fetch('https://api.example.com/data', {
  headers: {
    'Authorization': 'Bearer your-api-key'
  }
});
\`\`\`
`
        },
        {
            filename: 'guides/deployment.md',
            content: `---
title: Deployment Guide
description: Deploy your application to production
tags: [deployment, production]
---

# Deployment Guide

This guide covers deploying your application to various platforms.

## Prerequisites

- Node.js 16 or higher
- A hosting platform account

## Steps

1. Build your application
2. Configure environment variables
3. Deploy to your chosen platform

## Troubleshooting

Common deployment issues and solutions.
`
        }
    ];
    for (const doc of docs) {
        const filePath = path.join(sampleDir, 'docs', doc.filename);
        const fileDir = path.dirname(filePath);
        await fs.mkdir(fileDir, { recursive: true });
        await fs.writeFile(filePath, doc.content);
    }
    const blogPosts = [
        {
            filename: '2024-01-15-welcome.md',
            content: `---
slug: welcome
title: Welcome to Our Blog
authors: [admin]
tags: [welcome, announcement]
---

# Welcome to Our Blog

We're excited to share updates, tutorials, and insights with you.

<!--truncate-->

This is our first blog post. Stay tuned for more content!
`
        }
    ];
    for (const post of blogPosts) {
        const filePath = path.join(sampleDir, 'blog', post.filename);
        await fs.writeFile(filePath, post.content);
    }
    console.log(`✅ Sample Docusaurus project created at: ${sampleDir}`);
    return sampleDir;
}
async function testBasicGeneration() {
    console.log('🧪 Testing basic StaticMCP generation...');
    try {
        const sampleDir = await createSampleDocusaurusProject();
        const generator = new StaticMCPGenerator({
            outputDir: './test-output',
            serverName: 'Test Documentation Server',
            serverVersion: '1.0.0',
            baseUri: 'testdocs'
        });
        await generator.generate(sampleDir);
        const manifestPath = './test-output/mcp.json';
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);
        console.log('📋 Generated manifest:');
        console.log(`- Server: ${manifest.serverInfo.name} v${manifest.serverInfo.version}`);
        console.log(`- Protocol: ${manifest.protocolVersion}`);
        console.log(`- Resources: ${manifest.capabilities.resources.length}`);
        console.log(`- Tools: ${manifest.capabilities.tools.length}`);
        const resourcesDir = './test-output/resources';
        const resourceFiles = await getAllFiles(resourcesDir);
        console.log(`📄 Resource files: ${resourceFiles.length}`);
        if (resourceFiles.length > 0) {
            const sampleResourcePath = resourceFiles[0];
            const resourceContent = await fs.readFile(sampleResourcePath, 'utf-8');
            const resource = JSON.parse(resourceContent);
            console.log(`📖 Sample resource URI: ${resource.contents?.[0]?.uri}`);
        }
        const toolsDir = './test-output/tools';
        const toolDirs = await fs.readdir(toolsDir);
        console.log(`🔧 Tool directories: ${toolDirs.join(', ')}`);
        console.log('✅ Basic generation test passed!');
    }
    catch (error) {
        console.log(error);
        console.error('❌ Test failed:', error.message);
        throw error;
    }
}
async function getAllFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
        const res = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return getAllFiles(res);
        }
        else {
            return res;
        }
    }));
    return files.flat();
}
async function testResourceContent() {
    console.log('\n🧪 Testing resource content extraction...');
    try {
        const resourcesDir = './test-output/resources';
        const allFiles = await getAllFiles(resourcesDir);
        const expectedTitles = [
            'Getting Started',
            'Authentication',
            'Deployment Guide',
            'Welcome to Our Blog'
        ];
        const expectedDescriptions = [
            'Learn how to get started with our platform',
            'How to authenticate with our API',
            'Deploy your application to production',
            'Welcome to Our Blog'
        ];
        for (const file of allFiles) {
            const content = await fs.readFile(file, 'utf-8');
            const resource = JSON.parse(content);
            if (!resource.contents || !Array.isArray(resource.contents) || resource.contents.length === 0) {
                throw new Error(`Resource file ${file} is missing a non-empty 'contents' array`);
            }
            const firstContent = resource.contents[0];
            if (!firstContent.uri || typeof firstContent.uri !== 'string') {
                throw new Error(`Resource file ${file} is missing a valid 'uri' in contents[0]`);
            }
            if (!firstContent.mimeType || typeof firstContent.mimeType !== 'string') {
                throw new Error(`Resource file ${file} is missing a valid 'mimeType' in contents[0]`);
            }
            if (firstContent.mimeType !== 'text/markdown') {
                throw new Error(`Resource file ${file} has unexpected mimeType: ${firstContent.mimeType}`);
            }
            if (typeof firstContent.text !== 'string' || firstContent.text.trim().length === 0) {
                throw new Error(`Resource file ${file} is missing a valid, non-empty 'text' in contents[0]`);
            }
            const lines = firstContent.text.split('\n');
            const hasHeader = lines.some((line) => line.trim().startsWith('#'));
            const hasParagraph = lines.some((line) => line.trim().length > 0 && !line.trim().startsWith('#') && !line.trim().startsWith('```'));
            if (!hasHeader) {
                throw new Error(`Resource file ${file} text does not contain a markdown header`);
            }
            if (!hasParagraph) {
                throw new Error(`Resource file ${file} text does not contain a paragraph`);
            }
            if (firstContent.metadata) {
                if (typeof firstContent.metadata !== 'object') {
                    throw new Error(`Resource file ${file} has invalid 'metadata' in contents[0]`);
                }
                if (firstContent.metadata.title) {
                    if (!expectedTitles.includes(firstContent.metadata.title)) {
                        throw new Error(`Resource file ${file} has unexpected title: ${firstContent.metadata.title}`);
                    }
                }
                else {
                    throw new Error(`Resource file ${file} is missing 'title' in metadata`);
                }
            }
            else {
                throw new Error(`Resource file ${file} is missing 'metadata' in contents[0]`);
            }
        }
        console.log('\n✅ Resource content test passed!');
    }
    catch (error) {
        console.error('❌ Resource content test failed:', error.message);
        throw error;
    }
}
async function testToolResponses() {
    console.log('\n🧪 Testing tool responses...');
    try {
        const toolsDir = './test-output/tools';
        const listDir = path.join(toolsDir, 'list_docs');
        const listFiles = await fs.readdir(listDir);
        if (listFiles.length === 0) {
            throw new Error('No tool response files found in list_docs');
        }
        for (const file of listFiles) {
            const sampleListPath = path.join(listDir, file);
            const listResponse = await fs.readFile(sampleListPath, 'utf-8');
            const list = JSON.parse(listResponse);
            if (!list.content || !Array.isArray(list.content) || list.content.length === 0) {
                throw new Error(`Tool response file ${file} is missing a non-empty 'content' array`);
            }
            const firstContent = list.content[0];
            if (!firstContent.type || typeof firstContent.type !== 'string') {
                throw new Error(`Tool response file ${file} is missing a valid 'type' in content[0]`);
            }
            if (firstContent.type !== 'text') {
                throw new Error(`Tool response file ${file} has unexpected type: ${firstContent.type}`);
            }
            if (typeof firstContent.text !== 'string' || firstContent.text.trim().length === 0) {
                throw new Error(`Tool response file ${file} is missing a valid, non-empty 'text' in content[0]`);
            }
            try {
                const resources = JSON.parse(firstContent.text);
                if (!Array.isArray(resources)) {
                    throw new Error('Parsed text is not an array');
                }
                for (const resource of resources) {
                    if (!resource.uri || typeof resource.uri !== 'string') {
                        throw new Error(`Resource in tool response ${file} is missing a valid 'uri'`);
                    }
                    if (!resource.name || typeof resource.name !== 'string') {
                        throw new Error(`Resource in tool response ${file} is missing a valid 'name'`);
                    }
                    if (!resource.description || typeof resource.description !== 'string') {
                        throw new Error(`Resource in tool response ${file} is missing a valid 'description'`);
                    }
                    if (!resource.mimeType || typeof resource.mimeType !== 'string') {
                        throw new Error(`Resource in tool response ${file} is missing a valid 'mimeType'`);
                    }
                }
            }
            catch (e) {
                throw new Error(`Tool response file ${file} has invalid JSON in content[0].text: ${e.message}`);
            }
        }
        console.log('✅ Tool responses test passed!');
    }
    catch (error) {
        console.error('❌ Tool responses test failed:', error.message);
        throw error;
    }
}
async function testCustomConfiguration() {
    console.log('\n🧪 Testing custom configuration...');
    try {
        const generator = new StaticMCPGenerator({
            outputDir: './test-custom-output',
            serverName: 'Custom Docs Server',
            serverVersion: '2.1.0',
            baseUri: 'knowledge',
            protocolVersion: '2024-11-05'
        });
        await generator.generate('./sample-docusaurus');
        const manifestPath = './test-custom-output/mcp.json';
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
        console.log('⚙️ Custom configuration test:');
        console.log(`   Server name: ${manifest.serverInfo.name}`);
        console.log(`   Server version: ${manifest.serverInfo.version}`);
        console.log(`   Protocol version: ${manifest.protocolVersion}`);
        const firstResource = manifest.capabilities.resources[0];
        const hasCustomBase = firstResource.uri.startsWith('knowledge://');
        console.log(`   Custom base URI used: ${hasCustomBase}`);
        if (!hasCustomBase) {
            throw new Error('Custom base URI not applied correctly');
        }
        console.log('✅ Custom configuration test passed!');
    }
    catch (error) {
        console.error('❌ Custom configuration test failed:', error.message);
        throw error;
    }
}
async function cleanup() {
    console.log('\n🧹 Cleaning up test files...');
    try {
        await fs.rm('./sample-docusaurus', { recursive: true, force: true });
        if (process.env.KEEP_OUTPUT !== 'TRUE') {
            await fs.rm('./test-output', { recursive: true, force: true });
        }
        await fs.rm('./test-custom-output', { recursive: true, force: true });
        console.log('✅ Cleanup completed!');
    }
    catch (error) {
        console.warn('⚠️ Cleanup warning:', error.message);
    }
}
async function runTests() {
    console.log('🚀 StaticMCP Generator Test Suite\n');
    console.log('=' + '='.repeat(50));
    try {
        await testBasicGeneration();
        await testResourceContent();
        await testToolResponses();
        await testCustomConfiguration();
        console.log('\n' + '='.repeat(51));
        console.log('🎉 All tests passed successfully!');
    }
    catch (error) {
        console.log('\n' + '='.repeat(51));
        console.error('💥 Test suite failed!');
        console.error('Error:', error.message);
        process.exit(1);
    }
    finally {
        await cleanup();
    }
}
if (process.argv[1] === path.resolve(process.argv[1])) {
    runTests();
}
export { runTests, createSampleDocusaurusProject, testBasicGeneration, testResourceContent, testToolResponses, testCustomConfiguration, cleanup };
