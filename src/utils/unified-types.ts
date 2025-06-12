/**
 * Unified Data Format Specification for Claude-Flow
 * 
 * This file defines the standardized data formats to resolve inconsistencies
 * between tasks, agents, and persistence layers across the codebase.
 */

// Core enums for standardization
export enum UnifiedTaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued', 
  ASSIGNED = 'assigned',
  RUNNING = 'running',        // Standardize on 'running' not 'in_progress'
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum UnifiedAgentType {
  COORDINATOR = 'coordinator',
  RESEARCHER = 'researcher',
  IMPLEMENTER = 'implementer',
  ANALYST = 'analyst',
  CUSTOM = 'custom'
}

export enum UnifiedAgentStatus {
  ACTIVE = 'active',
  IDLE = 'idle',
  TERMINATED = 'terminated',
  ERROR = 'error'
}

export enum UnifiedMemoryEntryType {
  OBSERVATION = 'observation',
  INSIGHT = 'insight',
  DECISION = 'decision',
  ARTIFACT = 'artifact',
  ERROR = 'error'
}

// Unified error format
export interface UnifiedError {
  message: string;
  code?: string;
  stack?: string;
  timestamp: string;          // ISO format
  metadata?: Record<string, unknown>;
}

// Unified Task interface
export interface UnifiedTask {
  // Core identification
  id: string;                    // Format: task_${timestamp}_${random}
  type: string;
  description: string;
  
  // Scheduling
  priority: number;              // 0-100 scale
  dependencies: string[];        // Array of task IDs
  assignedAgent?: string;        // Agent ID
  
  // Status and lifecycle
  status: UnifiedTaskStatus;
  progress: number;              // 0-100 percentage
  
  // Data
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: UnifiedError;
  
  // Timestamps (ISO strings for consistent serialization)
  createdAt: string;             // ISO format
  startedAt?: string;
  completedAt?: string;
  lastUpdated: string;
  
  // Metadata
  metadata: Record<string, unknown>;
  tags: string[];
  
  // Retry information
  attempts: number;
  maxRetries: number;
  
  // Optional session information
  sessionId?: string;
}

// Unified Agent Profile interface
export interface UnifiedAgentProfile {
  // Core identification
  id: string;                    // Format: agent_${timestamp}_${random}
  name: string;
  type: UnifiedAgentType;
  
  // Capabilities
  capabilities: string[];
  systemPrompt: string;
  
  // Configuration
  maxConcurrentTasks: number;
  priority: number;
  environment: Record<string, string>;
  workingDirectory?: string;
  shell?: string;
  
  // Status
  status: UnifiedAgentStatus;
  
  // Timestamps
  createdAt: string;             // ISO format
  lastActivity: string;
  
  // Metadata
  metadata: Record<string, unknown>;
  tags: string[];
  
  // Session information
  currentSession?: string;
  terminalId?: string;
}

// Unified Memory Entry interface
export interface UnifiedMemoryEntry {
  // Core identification  
  id: string;                    // Format: memory_${timestamp}_${random}
  agentId: string;
  sessionId: string;
  
  // Content
  type: UnifiedMemoryEntryType;
  content: string;
  context: Record<string, unknown>;
  
  // Timestamps
  timestamp: string;             // ISO format
  createdAt: string;
  updatedAt: string;
  
  // Versioning
  version: number;
  parentId?: string;
  
  // Metadata
  metadata: Record<string, unknown>;
  tags: string[];
  
  // Namespace for organization
  namespace?: string;
}

// Unified Session interface
export interface UnifiedSession {
  // Core identification
  id: string;                    // Format: session_${timestamp}_${random}
  agentId: string;
  terminalId?: string;
  
  // Status
  status: UnifiedAgentStatus;
  
  // Timestamps
  startTime: string;             // ISO format
  endTime?: string;
  lastActivity: string;
  
  // Memory bank reference
  memoryBankId?: string;
  
  // Metadata
  metadata: Record<string, unknown>;
  tags: string[];
}

// Unified Configuration interfaces
export interface UnifiedPersistenceConfig {
  // Storage backend type
  backend: 'sqlite' | 'json' | 'hybrid';
  
  // File paths
  dataDir: string;
  tasksFile?: string;
  agentsFile?: string;
  sessionsFile?: string;
  
  // SQLite specific
  sqlitePath?: string;
  
  // Backup and retention
  enableBackups: boolean;
  backupInterval: number;        // milliseconds
  retentionDays: number;
  
  // Performance
  batchSize: number;
  syncInterval: number;          // milliseconds
}

// Data transformation type guards
export function isUnifiedTask(obj: any): obj is UnifiedTask {
  return obj && 
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.priority === 'number' &&
    Array.isArray(obj.dependencies) &&
    Object.values(UnifiedTaskStatus).includes(obj.status) &&
    typeof obj.progress === 'number' &&
    typeof obj.input === 'object' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.lastUpdated === 'string' &&
    typeof obj.attempts === 'number' &&
    typeof obj.maxRetries === 'number';
}

export function isUnifiedAgentProfile(obj: any): obj is UnifiedAgentProfile {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    Object.values(UnifiedAgentType).includes(obj.type) &&
    Array.isArray(obj.capabilities) &&
    typeof obj.systemPrompt === 'string' &&
    typeof obj.maxConcurrentTasks === 'number' &&
    typeof obj.priority === 'number' &&
    typeof obj.environment === 'object' &&
    Object.values(UnifiedAgentStatus).includes(obj.status) &&
    typeof obj.createdAt === 'string' &&
    typeof obj.lastActivity === 'string';
}

export function isUnifiedMemoryEntry(obj: any): obj is UnifiedMemoryEntry {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.agentId === 'string' &&
    typeof obj.sessionId === 'string' &&
    Object.values(UnifiedMemoryEntryType).includes(obj.type) &&
    typeof obj.content === 'string' &&
    typeof obj.context === 'object' &&
    typeof obj.timestamp === 'string' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string' &&
    typeof obj.version === 'number';
}

// Validation schemas (using simple validation for now)
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateUnifiedTask(task: any): ValidationResult {
  const errors: string[] = [];
  
  if (!task.id || typeof task.id !== 'string') {
    errors.push('Task ID is required and must be a string');
  }
  
  if (!task.type || typeof task.type !== 'string') {
    errors.push('Task type is required and must be a string');
  }
  
  if (!task.description || typeof task.description !== 'string') {
    errors.push('Task description is required and must be a string');
  }
  
  if (typeof task.priority !== 'number' || task.priority < 0 || task.priority > 100) {
    errors.push('Task priority must be a number between 0 and 100');
  }
  
  if (!Array.isArray(task.dependencies)) {
    errors.push('Task dependencies must be an array');
  }
  
  if (!Object.values(UnifiedTaskStatus).includes(task.status)) {
    errors.push('Task status must be a valid UnifiedTaskStatus');
  }
  
  if (typeof task.progress !== 'number' || task.progress < 0 || task.progress > 100) {
    errors.push('Task progress must be a number between 0 and 100');
  }
  
  try {
    new Date(task.createdAt);
  } catch {
    errors.push('Task createdAt must be a valid ISO date string');
  }
  
  try {
    new Date(task.lastUpdated);
  } catch {
    errors.push('Task lastUpdated must be a valid ISO date string');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateUnifiedAgentProfile(agent: any): ValidationResult {
  const errors: string[] = [];
  
  if (!agent.id || typeof agent.id !== 'string') {
    errors.push('Agent ID is required and must be a string');
  }
  
  if (!agent.name || typeof agent.name !== 'string') {
    errors.push('Agent name is required and must be a string');
  }
  
  if (!Object.values(UnifiedAgentType).includes(agent.type)) {
    errors.push('Agent type must be a valid UnifiedAgentType');
  }
  
  if (!Array.isArray(agent.capabilities)) {
    errors.push('Agent capabilities must be an array');
  }
  
  if (!agent.systemPrompt || typeof agent.systemPrompt !== 'string') {
    errors.push('Agent systemPrompt is required and must be a string');
  }
  
  if (typeof agent.maxConcurrentTasks !== 'number' || agent.maxConcurrentTasks < 1) {
    errors.push('Agent maxConcurrentTasks must be a positive number');
  }
  
  if (typeof agent.priority !== 'number' || agent.priority < 0 || agent.priority > 100) {
    errors.push('Agent priority must be a number between 0 and 100');
  }
  
  if (!Object.values(UnifiedAgentStatus).includes(agent.status)) {
    errors.push('Agent status must be a valid UnifiedAgentStatus');
  }
  
  try {
    new Date(agent.createdAt);
  } catch {
    errors.push('Agent createdAt must be a valid ISO date string');
  }
  
  try {
    new Date(agent.lastActivity);
  } catch {
    errors.push('Agent lastActivity must be a valid ISO date string');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateUnifiedMemoryEntry(entry: any): ValidationResult {
  const errors: string[] = [];
  
  if (!entry.id || typeof entry.id !== 'string') {
    errors.push('Memory entry ID is required and must be a string');
  }
  
  if (!entry.agentId || typeof entry.agentId !== 'string') {
    errors.push('Memory entry agentId is required and must be a string');
  }
  
  if (!entry.sessionId || typeof entry.sessionId !== 'string') {
    errors.push('Memory entry sessionId is required and must be a string');
  }
  
  if (!Object.values(UnifiedMemoryEntryType).includes(entry.type)) {
    errors.push('Memory entry type must be a valid UnifiedMemoryEntryType');
  }
  
  if (!entry.content || typeof entry.content !== 'string') {
    errors.push('Memory entry content is required and must be a string');
  }
  
  if (typeof entry.version !== 'number' || entry.version < 1) {
    errors.push('Memory entry version must be a positive number');
  }
  
  try {
    new Date(entry.timestamp);
  } catch {
    errors.push('Memory entry timestamp must be a valid ISO date string');
  }
  
  try {
    new Date(entry.createdAt);
  } catch {
    errors.push('Memory entry createdAt must be a valid ISO date string');
  }
  
  try {
    new Date(entry.updatedAt);
  } catch {
    errors.push('Memory entry updatedAt must be a valid ISO date string');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}