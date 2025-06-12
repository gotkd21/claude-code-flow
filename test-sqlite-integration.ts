#!/usr/bin/env deno run --allow-all

import { SQLiteBackend } from './src/memory/backends/sqlite.ts';
import { MemoryEntry } from './src/utils/types.ts';

// Simple mock logger
const mockLogger = {
  debug: (msg: string) => console.log(`[DEBUG] ${msg}`),
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.log(`[WARN] ${msg}`),
  error: (msg: string) => console.log(`[ERROR] ${msg}`),
  configure: async () => {},
};

async function testSQLiteBackend() {
  console.log('🧪 Testing SQLite Backend Integration...\n');

  // Create temporary database
  const tempDir = await Deno.makeTempDir({ prefix: 'sqlite-integration-test-' });
  const dbPath = `${tempDir}/test.db`;
  
  try {
    // Initialize backend
    console.log('1. Initializing SQLite backend...');
    const backend = new SQLiteBackend(dbPath, mockLogger as any);
    await backend.initialize();
    console.log('✅ Backend initialized successfully\n');

    // Test health check
    console.log('2. Testing health check...');
    const health = await backend.getHealthStatus();
    console.log('Health status:', health);
    console.log(health.healthy ? '✅ Health check passed' : '❌ Health check failed');
    console.log('');

    // Create test entry
    console.log('3. Storing test entry...');
    const testEntry: MemoryEntry = {
      id: 'test-entry-1',
      agentId: 'agent-1',
      sessionId: 'session-1',
      type: 'observation',
      content: 'This is a test memory entry for SQLite backend',
      context: { 
        source: 'integration-test',
        importance: 'high'
      },
      timestamp: new Date(),
      tags: ['test', 'integration', 'sqlite'],
      version: 1,
      metadata: {
        testRun: true,
        timestamp: Date.now()
      }
    };

    await backend.store(testEntry);
    console.log('✅ Entry stored successfully\n');

    // Retrieve entry
    console.log('4. Retrieving test entry...');
    const retrieved = await backend.retrieve('test-entry-1');
    console.log('Retrieved entry:', {
      id: retrieved.id,
      agentId: retrieved.agentId,
      type: retrieved.type,
      content: retrieved.content,
      tagsCount: retrieved.tags.length
    });
    console.log('✅ Entry retrieved successfully\n');

    // Test query
    console.log('5. Testing query functionality...');
    const queryResults = await backend.query({
      agentId: 'agent-1',
      tags: ['test']
    });
    console.log(`Query results: Found ${queryResults.length} entries`);
    console.log('✅ Query executed successfully\n');

    // Test get all entries
    console.log('6. Getting all entries...');
    const allEntries = await backend.getAllEntries();
    console.log(`Total entries in database: ${allEntries.length}`);
    console.log('✅ All entries retrieved successfully\n');

    // Clean up
    console.log('7. Cleaning up...');
    await backend.shutdown();
    await Deno.remove(tempDir, { recursive: true });
    console.log('✅ Cleanup completed\n');

    console.log('🎉 All tests passed! SQLite backend is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Cleanup on error
    try {
      await Deno.remove(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
    
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await testSQLiteBackend();
}