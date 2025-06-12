#!/usr/bin/env deno run --allow-all

import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

async function debugSchemaVersion() {
  console.log('🔍 Debugging schema version issue...\n');

  // Create temporary database
  const tempDir = await Deno.makeTempDir({ prefix: 'debug-schema-' });
  const dbPath = `${tempDir}/debug.db`;
  
  try {
    console.log(`Database path: ${dbPath}`);
    
    // Test raw SQLite functionality
    console.log('1. Creating raw SQLite database...');
    const db = new DB(dbPath);
    
    console.log('2. Creating schema_version table...');
    db.query(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        description TEXT
      )
    `);
    
    console.log('3. Testing MAX query on empty table...');
    const emptyResults = db.query('SELECT MAX(version) as version FROM schema_version');
    console.log('Empty table results:', emptyResults);
    console.log('Empty table result type:', typeof emptyResults[0]);
    console.log('Empty table result[0]:', emptyResults[0]);
    console.log('Empty table result[0][0]:', emptyResults[0] ? emptyResults[0][0] : 'no first element');
    console.log('Empty table result[0].version:', emptyResults[0] ? (emptyResults[0] as any).version : 'no version property');
    
    // Check what happens when we access as array vs object
    if (emptyResults.length > 0) {
      const row = emptyResults[0];
      console.log('Row as array:', Array.isArray(row) ? row : 'not array');
      console.log('Row as object keys:', Object.keys(row));
      
      if (Array.isArray(row)) {
        console.log('Array value [0]:', row[0]);
        console.log('Array value [0] === null:', row[0] === null);
      }
    }
    
    console.log('\n4. Adding a version and testing...');
    db.query('INSERT INTO schema_version (version, description) VALUES (?, ?)', [1, 'Test version']);
    
    const withDataResults = db.query('SELECT MAX(version) as version FROM schema_version');
    console.log('With data results:', withDataResults);
    console.log('With data result[0]:', withDataResults[0]);
    
    db.close();
    
    console.log('✅ Schema version debug completed');
    
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
  await debugSchemaVersion();
}