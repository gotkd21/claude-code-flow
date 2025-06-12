/**
 * Unit tests for SQLite Backend Implementation
 */

import { assertEquals, assertExists, assertRejects, assertThrows } from "https://deno.land/std@0.220.0/assert/mod.ts";
import { beforeEach, afterEach, describe, it } from "https://deno.land/std@0.220.0/testing/bdd.ts";

import { SQLiteBackend } from '../../../src/memory/backends/sqlite.ts';
import { ILogger } from '../../../src/core/logger.ts';
import { MemoryEntry, MemoryQuery, LoggingConfig } from '../../../src/utils/types.ts';

// Mock logger for testing
class MockLogger implements ILogger {
  debug(message: string, _metadata?: any): void {
    console.log(`[DEBUG] ${message}`);
  }
  
  info(message: string, _metadata?: any): void {
    console.log(`[INFO] ${message}`);
  }
  
  warn(message: string, _metadata?: any): void {
    console.log(`[WARN] ${message}`);
  }
  
  error(message: string, _metadata?: any): void {
    console.log(`[ERROR] ${message}`);
  }

  async configure(_config: LoggingConfig): Promise<void> {
    // Mock implementation
  }
}

describe('SQLite Backend', () => {
  let backend: SQLiteBackend;
  let tempDir: string;
  let logger: MockLogger;

  beforeEach(async () => {
    // Create temporary directory for test database
    tempDir = await Deno.makeTempDir({ prefix: 'sqlite-test-' });
    logger = new MockLogger();
    
    // Initialize SQLite backend
    backend = new SQLiteBackend(`${tempDir}/test.db`, logger);
    await backend.initialize();
  });

  afterEach(async () => {
    if (backend) {
      await backend.shutdown();
    }
    
    // Clean up temporary directory
    try {
      await Deno.remove(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Database Initialization', () => {
    it('should initialize database and create tables', async () => {
      // Backend should be initialized in beforeEach
      assertExists(backend);
      
      // Health check should pass
      const health = await backend.getHealthStatus();
      assertEquals(health.healthy, true);
    });

    it('should handle schema versioning', async () => {
      // Create a new backend to test schema initialization
      const newBackend = new SQLiteBackend(`${tempDir}/schema-test.db`, logger);
      await newBackend.initialize();
      
      const health = await newBackend.getHealthStatus();
      assertEquals(health.healthy, true);
      
      await newBackend.shutdown();
    });

    it('should report database metrics', async () => {
      const health = await backend.getHealthStatus();
      
      assertEquals(health.healthy, true);
      assertExists(health.metrics);
      assertEquals(typeof health.metrics.entryCount, 'number');
      assertEquals(typeof health.metrics.dbSizeBytes, 'number');
    });
  });

  describe('Basic CRUD Operations', () => {
    it('should store and retrieve memory entries', async () => {
      const entry: MemoryEntry = {
        id: 'test-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        type: 'observation',
        content: 'Test memory content',
        context: { source: 'test' },
        timestamp: new Date(),
        tags: ['test', 'memory'],
        version: 1,
      };

      await backend.store(entry);
      const retrieved = await backend.retrieve('test-1');

      assertExists(retrieved);
      assertEquals(retrieved.id, entry.id);
      assertEquals(retrieved.agentId, entry.agentId);
      assertEquals(retrieved.sessionId, entry.sessionId);
      assertEquals(retrieved.type, entry.type);
      assertEquals(retrieved.content, entry.content);
      assertEquals(retrieved.tags, entry.tags);
      assertEquals(retrieved.version, entry.version);
    });

    it('should update existing entries', async () => {
      const originalEntry: MemoryEntry = {
        id: 'update-test',
        agentId: 'agent-1',
        sessionId: 'session-1',
        type: 'insight',
        content: 'Original content',
        context: {},
        timestamp: new Date(),
        tags: ['original'],
        version: 1,
      };

      // Store original
      await backend.store(originalEntry);

      // Update with new content
      const updatedEntry: MemoryEntry = {
        ...originalEntry,
        content: 'Updated content',
        tags: ['updated'],
        version: 2,
      };

      await backend.update('update-test', updatedEntry);
      const retrieved = await backend.retrieve('update-test');

      assertExists(retrieved);
      assertEquals(retrieved.content, 'Updated content');
      assertEquals(retrieved.tags, ['updated']);
      assertEquals(retrieved.version, 2);
    });

    it('should delete entries', async () => {
      const entry: MemoryEntry = {
        id: 'delete-test',
        agentId: 'agent-1',
        sessionId: 'session-1',
        type: 'decision',
        content: 'To be deleted',
        context: {},
        timestamp: new Date(),
        tags: ['delete'],
        version: 1,
      };

      await backend.store(entry);
      await backend.delete('delete-test');

      // Should throw error when trying to retrieve deleted entry
      await assertRejects(
        () => backend.retrieve('delete-test'),
        Error
      );
    });

    it('should handle non-existent entries', async () => {
      await assertRejects(
        () => backend.retrieve('non-existent'),
        Error
      );
    });
  });

  describe('Querying and Search', () => {
    beforeEach(async () => {
      // Create test data
      const testEntries: MemoryEntry[] = [
        {
          id: 'query-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          type: 'observation',
          content: 'First memory about JavaScript',
          context: { topic: 'programming' },
          timestamp: new Date('2024-01-01'),
          tags: ['javascript', 'programming'],
          version: 1,
        },
        {
          id: 'query-2',
          agentId: 'agent-1',
          sessionId: 'session-2',
          type: 'insight',
          content: 'Knowledge about Python',
          context: { topic: 'programming' },
          timestamp: new Date('2024-01-02'),
          tags: ['python', 'programming'],
          version: 1,
        },
        {
          id: 'query-3',
          agentId: 'agent-2',
          sessionId: 'session-1',
          type: 'decision',
          content: 'How to debug code',
          context: { topic: 'debugging' },
          timestamp: new Date('2024-01-03'),
          tags: ['debugging', 'development'],
          version: 1,
        },
      ];

      for (const entry of testEntries) {
        await backend.store(entry);
      }
    });

    it('should query by agent ID', async () => {
      const query: MemoryQuery = {
        agentId: 'agent-1',
      };

      const results = await backend.query(query);
      assertEquals(results.length, 2);
      
      for (const result of results) {
        assertEquals(result.agentId, 'agent-1');
      }
    });

    it('should query by session ID', async () => {
      const query: MemoryQuery = {
        sessionId: 'session-1',
      };

      const results = await backend.query(query);
      assertEquals(results.length, 2);
      
      for (const result of results) {
        assertEquals(result.sessionId, 'session-1');
      }
    });

    it('should query by type', async () => {
      const query: MemoryQuery = {
        type: 'observation',
      };

      const results = await backend.query(query);
      assertEquals(results.length, 1);
      assertEquals(results[0].type, 'episodic');
    });

    it('should search by content', async () => {
      const query: MemoryQuery = {
        search: 'JavaScript',
      };

      const results = await backend.query(query);
      assertEquals(results.length, 1);
      assertEquals(results[0].content.includes('JavaScript'), true);
    });

    it('should filter by tags', async () => {
      const query: MemoryQuery = {
        tags: ['programming'],
      };

      const results = await backend.query(query);
      assertEquals(results.length, 2);
      
      for (const result of results) {
        assertEquals(result.tags.includes('programming'), true);
      }
    });

    it('should combine multiple filters', async () => {
      const query: MemoryQuery = {
        agentId: 'agent-1',
        type: 'insight',
        tags: ['programming'],
      };

      const results = await backend.query(query);
      assertEquals(results.length, 1);
      assertEquals(results[0].id, 'query-2');
    });

    it('should support pagination', async () => {
      const query: MemoryQuery = {
        limit: 2,
        offset: 0,
      };

      const page1 = await backend.query(query);
      assertEquals(page1.length, 2);

      const query2: MemoryQuery = {
        limit: 2,
        offset: 2,
      };

      const page2 = await backend.query(query2);
      assertEquals(page2.length, 1);
    });

    it('should filter by time range', async () => {
      const query: MemoryQuery = {
        startTime: new Date('2024-01-02'),
        endTime: new Date('2024-01-03'),
      };

      const results = await backend.query(query);
      assertEquals(results.length, 2); // Should include entries from 01-02 and 01-03
    });
  });

  describe('Advanced Operations', () => {
    it('should retrieve all entries', async () => {
      // Store some test entries
      const entries: MemoryEntry[] = [
        {
          id: 'all-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          type: 'observation',
          content: 'Entry 1',
          context: {},
          timestamp: new Date(),
          tags: [],
          version: 1,
        },
        {
          id: 'all-2',
          agentId: 'agent-2',
          sessionId: 'session-2',
          type: 'insight',
          content: 'Entry 2',
          context: {},
          timestamp: new Date(),
          tags: [],
          version: 1,
        },
      ];

      for (const entry of entries) {
        await backend.store(entry);
      }

      const allEntries = await backend.getAllEntries();
      assertEquals(allEntries.length >= 2, true);
    });

    it('should handle complex JSON data in context and metadata', async () => {
      const complexEntry: MemoryEntry = {
        id: 'complex-test',
        agentId: 'agent-1',
        sessionId: 'session-1',
        type: 'insight',
        content: 'Complex data test',
        context: {
          nested: {
            data: {
              numbers: [1, 2, 3],
              strings: ['a', 'b', 'c'],
              boolean: true,
              null_value: null,
            },
          },
        },
        timestamp: new Date(),
        tags: ['complex', 'json'],
        version: 1,
        metadata: {
          source: 'test',
          confidence: 0.95,
          references: ['ref1', 'ref2'],
        },
      };

      await backend.store(complexEntry);
      const retrieved = await backend.retrieve('complex-test');

      assertExists(retrieved);
      assertEquals(retrieved.context, complexEntry.context);
      assertEquals(retrieved.metadata, complexEntry.metadata);
    });

    it('should handle entries with parent relationships', async () => {
      const parentEntry: MemoryEntry = {
        id: 'parent-entry',
        agentId: 'agent-1',
        sessionId: 'session-1',
        type: 'observation',
        content: 'Parent memory',
        context: {},
        timestamp: new Date(),
        tags: ['parent'],
        version: 1,
      };

      const childEntry: MemoryEntry = {
        id: 'child-entry',
        agentId: 'agent-1',
        sessionId: 'session-1',
        type: 'observation',
        content: 'Child memory',
        context: {},
        timestamp: new Date(),
        tags: ['child'],
        version: 1,
        parentId: 'parent-entry',
      };

      await backend.store(parentEntry);
      await backend.store(childEntry);

      const retrievedChild = await backend.retrieve('child-entry');
      assertExists(retrievedChild);
      assertEquals(retrievedChild.parentId, 'parent-entry');
    });
  });

  describe('Error Handling', () => {
    it('should handle database initialization errors', async () => {
      // Try to initialize with invalid path
      const invalidBackend = new SQLiteBackend('/invalid/path/database.db', logger);
      
      await assertRejects(
        () => invalidBackend.initialize(),
        Error
      );
    });

    it('should handle malformed entry data gracefully', async () => {
      // This tests the robustness of the JSON serialization
      const entry: MemoryEntry = {
        id: 'malformed-test',
        agentId: 'agent-1',
        sessionId: 'session-1',
        type: 'observation',
        content: 'Test with special characters: "quotes", \'apostrophes\', and unicode: 🚀',
        context: {
          special: '"quotes"',
          apostrophe: "'test'",
          unicode: '🎯',
        },
        timestamp: new Date(),
        tags: ['special', 'unicode'],
        version: 1,
      };

      await backend.store(entry);
      const retrieved = await backend.retrieve('malformed-test');

      assertExists(retrieved);
      assertEquals(retrieved.content, entry.content);
      assertEquals(retrieved.context, entry.context);
    });

    it('should provide meaningful error messages', async () => {
      await backend.shutdown();

      // Try to operate on closed database
      await assertRejects(
        () => backend.store({
          id: 'test',
          agentId: 'agent-1',
          sessionId: 'session-1',
          type: 'observation',
          content: 'test',
          context: {},
          timestamp: new Date(),
          tags: [],
          version: 1,
        }),
        Error,
        'Database not initialized'
      );
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent operations', async () => {
      const operations = Array.from({ length: 20 }, (_, i) => ({
        id: `concurrent-${i}`,
        agentId: 'agent-1',
        sessionId: 'session-1',
        type: 'observation' as const,
        content: `Concurrent entry ${i}`,
        context: { index: i },
        timestamp: new Date(),
        tags: ['concurrent'],
        version: 1,
      }));

      // Execute all store operations concurrently
      await Promise.all(
        operations.map(entry => backend.store(entry))
      );

      // Verify all entries were stored
      const allEntries = await backend.getAllEntries();
      assertEquals(allEntries.length >= 20, true);

      // Verify we can retrieve all entries
      const retrievalResults = await Promise.all(
        operations.map(entry => backend.retrieve(entry.id))
      );

      assertEquals(retrievalResults.length, 20);
      for (const result of retrievalResults) {
        assertExists(result);
      }
    });

    it('should maintain reasonable performance with large datasets', async () => {
      // Store a moderate number of entries to test performance
      const entryCount = 100;
      const entries = Array.from({ length: entryCount }, (_, i) => ({
        id: `perf-test-${i}`,
        agentId: `agent-${i % 5}`, // 5 different agents
        sessionId: `session-${i % 10}`, // 10 different sessions
        type: 'observation' as const,
        content: `Performance test entry ${i} with some content to search`,
        context: {
          index: i,
          category: i % 3 === 0 ? 'important' : 'normal',
        },
        timestamp: new Date(),
        tags: i % 2 === 0 ? ['even', 'test'] : ['odd', 'test'],
        version: 1,
      }));

      // Measure store performance
      const storeStart = Date.now();
      for (const entry of entries) {
        await backend.store(entry);
      }
      const storeTime = Date.now() - storeStart;
      console.log(`Stored ${entryCount} entries in ${storeTime}ms`);

      // Measure query performance
      const queryStart = Date.now();
      const results = await backend.query({ tags: ['test'] });
      const queryTime = Date.now() - queryStart;
      console.log(`Queried ${results.length} entries in ${queryTime}ms`);

      assertEquals(results.length, entryCount);
      assertEquals(storeTime < 10000, true); // Should complete within 10 seconds
      assertEquals(queryTime < 1000, true); // Query should be fast
    });
  });
});