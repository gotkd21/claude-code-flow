#!/usr/bin/env deno run --allow-all

import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

async function debugRowStructure() {
  console.log('🔍 Debugging SQLite row structure...\n');

  // Create temporary database
  const tempDir = await Deno.makeTempDir({ prefix: 'debug-row-' });
  const dbPath = `${tempDir}/debug.db`;
  
  try {
    console.log(`Database path: ${dbPath}`);
    
    // Create database and table
    const db = new DB(dbPath);
    
    // Create table
    db.query(`
      CREATE TABLE memory_entries (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        context TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        tags TEXT NOT NULL,
        version INTEGER NOT NULL,
        parent_id TEXT,
        metadata TEXT
      )
    `);
    
    // Insert test data
    db.query(`
      INSERT INTO memory_entries (
        id, agent_id, session_id, type, content, 
        context, timestamp, tags, version, parent_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'test-1',
      'agent-1', 
      'session-1',
      'observation',
      'Test content',
      '{"source":"test"}',
      '2024-01-01T00:00:00.000Z',
      '["test","debug"]',
      1,
      null, // parent_id is null
      '{"debug":true}'
    ]);
    
    // Query and examine structure
    console.log('1. Querying with SELECT *...');
    const allResults = db.query('SELECT * FROM memory_entries');
    console.log('All results:', allResults);
    console.log('First row:', allResults[0]);
    console.log('First row type:', typeof allResults[0]);
    console.log('First row is array:', Array.isArray(allResults[0]));
    console.log('First row keys:', Object.keys(allResults[0]));
    console.log('First row length:', allResults[0].length);
    
    // Query with specific column order
    console.log('\n2. Querying with explicit columns...');
    const specificResults = db.query(`
      SELECT id, agent_id, session_id, type, content, 
             context, timestamp, tags, version, parent_id, metadata
      FROM memory_entries
    `);
    console.log('Specific results:', specificResults);
    console.log('Specific first row:', specificResults[0]);
    
    // Test individual column access
    console.log('\n3. Testing column access...');
    const row = specificResults[0];
    console.log('row[0] (id):', row[0]);
    console.log('row[1] (agent_id):', row[1]);
    console.log('row[9] (parent_id):', row[9]);
    console.log('row[10] (metadata):', row[10]);
    
    db.close();
    
    console.log('\n✅ Row structure debug completed');
    
    // Clean up
    await Deno.remove(tempDir, { recursive: true });
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
    
    // Cleanup on error
    try {
      await Deno.remove(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

if (import.meta.main) {
  await debugRowStructure();
}