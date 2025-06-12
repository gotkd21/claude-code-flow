#!/usr/bin/env deno run --allow-all

import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

async function debugSQLite() {
  console.log('🔍 Debugging SQLite issue...\n');

  // Create temporary database
  const tempDir = await Deno.makeTempDir({ prefix: 'debug-sqlite-' });
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
    
    console.log('3. Checking schema_version...');
    const versionRows = db.query('SELECT MAX(version) as version FROM schema_version');
    console.log('Version query result:', versionRows);
    
    const currentVersion = versionRows.length > 0 && versionRows[0][0] !== null ? versionRows[0][0] as number : 0;
    console.log('Current version:', currentVersion);
    
    if (currentVersion === 0) {
      console.log('4. Running migration 1...');
      
      // Create main table
      db.query(`
        CREATE TABLE IF NOT EXISTS memory_entries (
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
          metadata TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('5. Creating indexes...');
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_agent_id ON memory_entries(agent_id)',
        'CREATE INDEX IF NOT EXISTS idx_session_id ON memory_entries(session_id)',
        'CREATE INDEX IF NOT EXISTS idx_type ON memory_entries(type)',
        'CREATE INDEX IF NOT EXISTS idx_timestamp ON memory_entries(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_parent_id ON memory_entries(parent_id)',
      ];

      for (const sql of indexes) {
        db.query(sql);
      }
      
      console.log('6. Recording migration...');
      db.query(
        'INSERT INTO schema_version (version, description) VALUES (?, ?)',
        [1, 'Migration to version 1']
      );
    }
    
    console.log('7. Testing table existence...');
    const tableCheck = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='memory_entries'");
    console.log('Table check result:', tableCheck);
    
    console.log('8. Testing entry count...');
    const countResult = db.query('SELECT COUNT(*) as count FROM memory_entries');
    console.log('Count result:', countResult);
    
    db.close();
    
    console.log('✅ Direct SQLite test completed successfully');
    
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
  await debugSQLite();
}