#!/usr/bin/env deno run --allow-all

/**
 * Example usage of MCP client
 */

import { MCPClient } from '../src/mcp/client.ts';
import { Logger } from '../src/core/logger.ts';
import { MCPProtocolVersion, MCPCapabilities } from '../src/utils/types.ts';

async function demonstrateMCPClient() {
  console.log('🔌 MCP Client Example\n');

  // Create logger
  const logger = new Logger({
    level: 'info',
    format: 'text',
    destination: 'console',
  });

  // Configure MCP client
  const clientConfig = {
    serverCommand: 'node', // Example: Node.js MCP server
    serverArgs: ['path/to/mcp-server.js'],
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
    clientInfo: {
      name: 'Claude-Flow Example',
      version: '1.0.0',
    },
    capabilities: {
      logging: { level: 'info' as const },
      tools: { listChanged: true },
      resources: { listChanged: false, subscribe: false },
      prompts: { listChanged: false },
    } as MCPCapabilities,
  };

  // Create client
  const client = new MCPClient(clientConfig, logger);

  try {
    console.log('1. Connecting to MCP server...');
    await client.connect();
    console.log('✅ Connected to server');

    console.log('\n2. Initializing session...');
    const initResult = await client.initialize();
    console.log('✅ Session initialized');
    console.log('Server info:', initResult.serverInfo);
    console.log('Protocol version:', initResult.protocolVersion);

    console.log('\n3. Listing available tools...');
    const tools = await client.listTools();
    console.log(`✅ Found ${tools.length} tools:`);
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    console.log('\n4. Listing available prompts...');
    try {
      const prompts = await client.listPrompts();
      console.log(`✅ Found ${prompts.length} prompts:`);
      prompts.forEach(prompt => {
        console.log(`  - ${prompt.name}: ${prompt.description || 'No description'}`);
      });
    } catch (error) {
      console.log('ℹ️ Server does not support prompts or no prompts available');
    }

    console.log('\n5. Listing available resources...');
    try {
      const resources = await client.listResources();
      console.log(`✅ Found ${resources.length} resources:`);
      resources.forEach(resource => {
        console.log(`  - ${resource.uri}: ${resource.name}`);
      });
    } catch (error) {
      console.log('ℹ️ Server does not support resources or no resources available');
    }

    // Example tool call (if tools are available)
    if (tools.length > 0) {
      console.log('\n6. Calling first available tool...');
      try {
        const result = await client.callTool({
          name: tools[0].name,
          arguments: {}, // Use appropriate arguments for the tool
        });
        console.log('✅ Tool call successful');
        console.log('Result:', result);
      } catch (error) {
        console.log('⚠️ Tool call failed:', error instanceof Error ? error.message : error);
      }
    }

    console.log('\n7. Checking client health...');
    const health = await client.getHealthStatus();
    console.log('✅ Health check complete');
    console.log('Healthy:', health.healthy);
    console.log('Metrics:', health.metrics);

  } catch (error) {
    console.error('❌ Example failed:', error instanceof Error ? error.message : error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
  } finally {
    console.log('\n8. Disconnecting...');
    await client.disconnect();
    console.log('✅ Disconnected');
  }

  console.log('\n🎉 MCP Client example completed');
}

if (import.meta.main) {
  await demonstrateMCPClient();
}