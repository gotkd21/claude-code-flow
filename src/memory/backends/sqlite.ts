/**
 * SQLite backend implementation for memory storage
 */

import { IMemoryBackend } from './base.ts';
import { MemoryEntry, MemoryQuery } from '../../utils/types.ts';
import { ILogger } from '../../core/logger.ts';
import { MemoryBackendError } from '../../utils/errors.ts';
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

// Type for SQLite query parameters
type SQLiteParam = string | number | boolean | null | undefined;

// SQLite wrapper to match expected interface
interface Database {
  execute(sql: string, params?: unknown[]): Promise<unknown[]>;
  close(): Promise<void>;
}

class SQLiteWrapper implements Database {
  constructor(private db: DB) {}

  async execute(sql: string, params?: unknown[]): Promise<unknown[]> {
    try {
      const trimmedSql = sql.trim().toUpperCase();
      
      // Convert unknown[] to SQLiteParam[] for type safety
      const sqliteParams: SQLiteParam[] = params ? params.map(p => 
        p === undefined ? null : p as SQLiteParam
      ) : [];
      
      // Check if this is a query that returns data
      if (trimmedSql.startsWith('SELECT') || 
          trimmedSql.includes('PRAGMA') ||
          trimmedSql.startsWith('EXPLAIN')) {
        // Query operation - return rows
        const rows = this.db.query(sql, sqliteParams);
        return Array.isArray(rows) ? rows : [];
      } else {
        // Non-query operation (INSERT, UPDATE, DELETE, CREATE, etc.)
        this.db.query(sql, sqliteParams);
        return [];
      }
    } catch (error) {
      throw new Error(`SQLite operation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

/**
 * SQLite-based memory backend
 */
export class SQLiteBackend implements IMemoryBackend {
  private db?: Database;

  constructor(
    private dbPath: string,
    private logger: ILogger,
  ) {}

  async initialize(): Promise<void> {
    this.logger.info('Initializing SQLite backend', { dbPath: this.dbPath });

    try {
      // Open SQLite connection
      const sqliteDb = new DB(this.dbPath);
      this.db = new SQLiteWrapper(sqliteDb);

      // Initialize schema versioning
      await this.initializeSchema();

      this.logger.info('SQLite backend initialized');
    } catch (error) {
      throw new MemoryBackendError('Failed to initialize SQLite backend', { error });
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down SQLite backend');

    if (this.db) {
      await this.db.close();
      delete this.db;
    }
  }

  async store(entry: MemoryEntry): Promise<void> {
    if (!this.db) {
      throw new MemoryBackendError('Database not initialized');
    }

    const sql = `
      INSERT OR REPLACE INTO memory_entries (
        id, agent_id, session_id, type, content, 
        context, timestamp, tags, version, parent_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      entry.id,
      entry.agentId,
      entry.sessionId,
      entry.type,
      entry.content,
      JSON.stringify(entry.context),
      entry.timestamp.toISOString(),
      JSON.stringify(entry.tags),
      entry.version,
      entry.parentId || null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    ];

    try {
      await this.db.execute(sql, params);
    } catch (error) {
      throw new MemoryBackendError('Failed to store entry', { error });
    }
  }

  async retrieve(id: string): Promise<MemoryEntry | undefined> {
    if (!this.db) {
      throw new MemoryBackendError('Database not initialized');
    }

    const sql = 'SELECT * FROM memory_entries WHERE id = ?';
    
    try {
      const rows = await this.db.execute(sql, [id]);
      
      if (rows.length === 0) {
        return undefined;
      }

      return this.rowToEntry(rows[0] as unknown[]);
    } catch (error) {
      throw new MemoryBackendError('Failed to retrieve entry', { error });
    }
  }

  async update(id: string, entry: MemoryEntry): Promise<void> {
    // SQLite INSERT OR REPLACE handles updates
    await this.store(entry);
  }

  async delete(id: string): Promise<void> {
    if (!this.db) {
      throw new MemoryBackendError('Database not initialized');
    }

    const sql = 'DELETE FROM memory_entries WHERE id = ?';
    
    try {
      await this.db.execute(sql, [id]);
    } catch (error) {
      throw new MemoryBackendError('Failed to delete entry', { error });
    }
  }

  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    if (!this.db) {
      throw new MemoryBackendError('Database not initialized');
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.agentId) {
      conditions.push('agent_id = ?');
      params.push(query.agentId);
    }

    if (query.sessionId) {
      conditions.push('session_id = ?');
      params.push(query.sessionId);
    }

    if (query.type) {
      conditions.push('type = ?');
      params.push(query.type);
    }

    if (query.startTime) {
      conditions.push('timestamp >= ?');
      params.push(query.startTime.toISOString());
    }

    if (query.endTime) {
      conditions.push('timestamp <= ?');
      params.push(query.endTime.toISOString());
    }

    if (query.search) {
      conditions.push('(content LIKE ? OR tags LIKE ?)');
      params.push(`%${query.search}%`, `%${query.search}%`);
    }

    if (query.tags && query.tags.length > 0) {
      const tagConditions = query.tags.map(() => 'tags LIKE ?');
      conditions.push(`(${tagConditions.join(' OR ')})`);
      query.tags.forEach(tag => params.push(`%"${tag}"%`));
    }

    let sql = 'SELECT * FROM memory_entries';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY timestamp DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    if (query.offset) {
      sql += ' OFFSET ?';
      params.push(query.offset);
    }

    try {
      const rows = await this.db.execute(sql, params);
      return rows.map(row => this.rowToEntry(row as unknown[]));
    } catch (error) {
      throw new MemoryBackendError('Failed to query entries', { error });
    }
  }

  async getAllEntries(): Promise<MemoryEntry[]> {
    if (!this.db) {
      throw new MemoryBackendError('Database not initialized');
    }

    const sql = 'SELECT * FROM memory_entries ORDER BY timestamp DESC';
    
    try {
      const rows = await this.db.execute(sql);
      return rows.map(row => this.rowToEntry(row as unknown[]));
    } catch (error) {
      throw new MemoryBackendError('Failed to get all entries', { error });
    }
  }

  async getHealthStatus(): Promise<{ 
    healthy: boolean; 
    error?: string; 
    metrics?: Record<string, number>;
  }> {
    if (!this.db) {
      return {
        healthy: false,
        error: 'Database not initialized',
      };
    }

    try {
      // Check database connectivity
      await this.db.execute('SELECT 1');

      // Get metrics
      const countResults = await this.db.execute(
        'SELECT COUNT(*) as count FROM memory_entries',
      );
      const entryCount = countResults.length > 0 ? (countResults[0] as unknown[])[0] as number : 0;

      // Use separate pragma queries for database size
      const pageCountResults = await this.db.execute('PRAGMA page_count');
      const pageSizeResults = await this.db.execute('PRAGMA page_size');
      
      const pageCount = pageCountResults.length > 0 ? (pageCountResults[0] as unknown[])[0] as number : 0;
      const pageSize = pageSizeResults.length > 0 ? (pageSizeResults[0] as unknown[])[0] as number : 0;
      const dbSize = pageCount * pageSize;

      return {
        healthy: true,
        metrics: {
          entryCount,
          dbSizeBytes: dbSize,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async initializeSchema(): Promise<void> {
    // Create schema version table first
    await this.createSchemaVersionTable();

    // Get current schema version
    const currentVersion = await this.getCurrentSchemaVersion();
    this.logger.info('Current schema version', { version: currentVersion });

    // Run migrations to latest version
    await this.migrateToLatest(currentVersion);
  }

  private async createSchemaVersionTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        description TEXT
      )
    `;
    await this.db!.execute(sql);
  }

  private async getCurrentSchemaVersion(): Promise<number> {
    try {
      const results = await this.db!.execute(
        'SELECT MAX(version) as version FROM schema_version'
      );
      
      this.logger.info('Schema version query results', { results });
      
      if (results.length > 0 && (results[0] as unknown[])[0] !== null) {
        const version = (results[0] as unknown[])[0] as number;
        this.logger.info('Found schema version', { version });
        return version;
      }
      
      this.logger.info('No schema version found, returning 0');
      return 0; // No version found, start from 0
    } catch (error) {
      this.logger.warn('Failed to get schema version, assuming version 0', { error });
      return 0;
    }
  }

  private async migrateToLatest(currentVersion: number): Promise<void> {
    const targetVersion = 1; // Current latest version
    
    this.logger.info('Migration check', { currentVersion, targetVersion });
    
    if (currentVersion >= targetVersion) {
      this.logger.info('Schema is up to date', { currentVersion, targetVersion });
      return;
    }

    this.logger.info('Running schema migrations', { from: currentVersion, to: targetVersion });

    // Run migrations in sequence
    for (let version = currentVersion + 1; version <= targetVersion; version++) {
      this.logger.info('About to run migration', { version });
      await this.runMigration(version);
    }
    
    this.logger.info('All migrations completed');
  }

  private async runMigration(version: number): Promise<void> {
    this.logger.info('Running migration', { version });

    try {
      switch (version) {
        case 1:
          this.logger.info('Executing migration_001_initial_schema');
          await this.migration_001_initial_schema();
          this.logger.info('migration_001_initial_schema completed');
          break;
        default:
          throw new Error(`Unknown migration version: ${version}`);
      }

      // Record successful migration
      this.logger.info('Recording migration completion');
      await this.recordMigration(version);
      this.logger.info('Migration completed', { version });
    } catch (error) {
      this.logger.error('Migration failed', { version, error });
      throw new MemoryBackendError(`Migration ${version} failed`, { error });
    }
  }

  private async migration_001_initial_schema(): Promise<void> {
    // Create the main memory_entries table
    await this.createTables();
    // Create indexes for the table
    await this.createIndexes();
  }

  private async recordMigration(version: number): Promise<void> {
    await this.db!.execute(
      'INSERT INTO schema_version (version, description) VALUES (?, ?)',
      [version, `Migration to version ${version}`]
    );
  }

  private async createTables(): Promise<void> {
    this.logger.info('Creating memory_entries table');
    const sql = `
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
    `;

    await this.db!.execute(sql);
    this.logger.info('memory_entries table created successfully');
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_agent_id ON memory_entries(agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_session_id ON memory_entries(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_type ON memory_entries(type)',
      'CREATE INDEX IF NOT EXISTS idx_timestamp ON memory_entries(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_parent_id ON memory_entries(parent_id)',
    ];

    for (const sql of indexes) {
      await this.db!.execute(sql);
    }
  }

  private rowToEntry(row: unknown[]): MemoryEntry {
    // SQLite returns rows as arrays in column order:
    // id, agent_id, session_id, type, content, context, timestamp, tags, version, parent_id, metadata
    const entry: MemoryEntry = {
      id: row[0] as string,
      agentId: row[1] as string,
      sessionId: row[2] as string,
      type: row[3] as MemoryEntry['type'],
      content: row[4] as string,
      context: JSON.parse(row[5] as string),
      timestamp: new Date(row[6] as string),
      tags: JSON.parse(row[7] as string),
      version: row[8] as number,
    };
    
    if (row[9] !== null) {
      entry.parentId = row[9] as string;
    }
    
    if (row[10] !== null) {
      entry.metadata = JSON.parse(row[10] as string);
    }
    
    return entry;
  }
}

