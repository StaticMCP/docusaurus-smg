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
        const toolsDir = './test-output/tools';
        const resourcesDir = './test-output/resources';
        const toolsExists = await fs.stat(toolsDir).then(() => true).catch(() => false);
        const resourcesExists = await fs.stat(resourcesDir).then(() => true).catch(() => false);
        if (!toolsExists)
            throw new Error('tools directory not created');
        if (!resourcesExists)
            throw new Error('resources directory not created');
        const toolDirs = await fs.readdir(toolsDir);
        const resourceFiles = await getAllFiles(resourcesDir);
        console.log(`🔧 Tool directories: ${toolDirs.join(', ')}`);
        console.log(`📄 Resource files: ${resourceFiles.length}`);
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
async function testResourceAccess() {
    console.log('\n🧪 Testing resource access through tools...');
    try {
        const listResourcesPath = './test-output/tools/list_resources.json';
        const listContent = await fs.readFile(listResourcesPath, 'utf-8');
        const listResponse = JSON.parse(listContent);
        if (!listResponse.content || !Array.isArray(listResponse.content) || listResponse.content.length === 0) {
            throw new Error('list_resources response is missing content array');
        }
        const resourceUris = JSON.parse(listResponse.content[0].text);
        if (!Array.isArray(resourceUris)) {
            throw new Error('list_resources should return an array of URIs');
        }
        console.log(`📄 Found ${resourceUris.length} resource URIs`);
        if (resourceUris.length > 0) {
            const firstUri = resourceUris[0];
            let encodedUri;
            if (firstUri.includes('://')) {
                const parts = firstUri.split('://');
                encodedUri = parts.length === 2 ? parts[1].replace(/[*?"<>|]/g, '_') : firstUri.replace(/[*?"<>|]/g, '_');
            }
            else {
                encodedUri = firstUri.replace(/[*?"<>|]/g, '_');
            }
            const getResourcePath = `./test-output/tools/get_resource/${encodedUri}.json`;
            const resourceContent = await fs.readFile(getResourcePath, 'utf-8');
            const resourceResponse = JSON.parse(resourceContent);
            if (!resourceResponse.content || !resourceResponse.content[0] || !resourceResponse.content[0].text) {
                throw new Error('get_resource response missing content');
            }
            const resourceData = JSON.parse(resourceResponse.content[0].text);
            if (!resourceData.uri || !resourceData.content || !resourceData.metadata) {
                throw new Error('get_resource response missing required fields (uri, content, metadata)');
            }
            console.log(`📖 Successfully accessed resource: ${resourceData.name || 'Untitled'}`);
            console.log(`   URI: ${resourceData.uri}`);
            console.log(`   Content length: ${resourceData.content.length} chars`);
            console.log(`   Has metadata: ${Object.keys(resourceData.metadata || {}).length > 0}`);
        }
        const resourcesDir = './test-output/resources';
        const resourceFiles = await getAllFiles(resourcesDir);
        console.log(`📁 Direct resource files: ${resourceFiles.length}`);
        if (resourceFiles.length > 0) {
            const sampleResourcePath = resourceFiles[0];
            const directResourceContent = await fs.readFile(sampleResourcePath, 'utf-8');
            const directResource = JSON.parse(directResourceContent);
            if (!directResource.contents || !Array.isArray(directResource.contents)) {
                throw new Error('Direct resource file missing contents array');
            }
            console.log(`📋 Direct resource format verified`);
        }
        console.log('✅ Resource access test passed!');
    }
    catch (error) {
        console.error('❌ Resource access test failed:', error.message);
        throw error;
    }
}
async function testToolResponses() {
    console.log('\n🧪 Testing tool responses...');
    try {
        const toolsDir = './test-output/tools';
        const toolNames = ['list_resources', 'get_resource'];
        for (const toolName of toolNames) {
            if (toolName === 'list_resources') {
                const toolFile = path.join(toolsDir, `${toolName}.json`);
                const toolExists = await fs.stat(toolFile).then(() => true).catch(() => false);
                if (toolExists) {
                    const content = await fs.readFile(toolFile, 'utf-8');
                    const response = JSON.parse(content);
                    if (!response.content || !Array.isArray(response.content)) {
                        throw new Error(`${toolName} response missing content array`);
                    }
                    const uris = JSON.parse(response.content[0].text);
                    if (!Array.isArray(uris)) {
                        throw new Error(`${toolName} should return array of URIs`);
                    }
                    for (const uri of uris) {
                        if (uri.includes('://')) {
                            throw new Error(`Invalid URI format: ${uri}`);
                        }
                    }
                    console.log(`  ✅ ${toolName}: ${uris.length} URIs returned`);
                }
                else {
                    throw new Error(`${toolName}.json file not found`);
                }
            }
            else if (toolName === 'get_resource') {
                const toolDir = path.join(toolsDir, toolName);
                const toolExists = await fs.stat(toolDir).then(() => true).catch(() => false);
                if (!toolExists) {
                    throw new Error(`Tool directory missing: ${toolName}`);
                }
                const allFiles = await getAllFiles(toolDir);
                if (allFiles.length === 0) {
                    throw new Error(`No response files found for ${toolName}`);
                }
                const filesToTest = allFiles.slice(0, Math.min(3, allFiles.length));
                let validResponses = 0;
                for (const file of filesToTest) {
                    const content = await fs.readFile(file, 'utf-8');
                    const response = JSON.parse(content);
                    if (!response.content || !Array.isArray(response.content)) {
                        console.log(`    ⚠️ ${path.basename(file)}: missing content array`);
                        continue;
                    }
                    const resourceData = JSON.parse(response.content[0].text);
                    const requiredFields = ['uri', 'name', 'description', 'mimeType', 'content', 'metadata'];
                    const missingFields = requiredFields.filter(field => !resourceData.hasOwnProperty(field));
                    if (missingFields.length === 0) {
                        validResponses++;
                        console.log(`    ✅ ${path.basename(file)}: valid resource data`);
                    }
                    else {
                        console.log(`    ⚠️ ${path.basename(file)}: missing fields: ${missingFields.join(', ')}`);
                    }
                }
                if (validResponses === 0) {
                    throw new Error(`No valid ${toolName} response files found`);
                }
                console.log(`  ✅ ${toolName}: ${validResponses}/${filesToTest.length} tested responses valid (${allFiles.length} total files)`);
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
        await testResourceAccess();
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
export { runTests, createSampleDocusaurusProject, testBasicGeneration, testResourceAccess, testToolResponses, testCustomConfiguration, cleanup };
