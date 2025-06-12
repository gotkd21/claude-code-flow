/**
 * Data transformation utilities for converting between legacy and unified formats
 */

import {
  UnifiedTask,
  UnifiedAgentProfile,
  UnifiedMemoryEntry,
  UnifiedTaskStatus,
  UnifiedAgentType,
  UnifiedAgentStatus,
  UnifiedMemoryEntryType,
  UnifiedError,
} from './unified-types.ts';
import { Task, AgentProfile, MemoryEntry, TaskStatus } from './types.ts';
import { generateId } from './helpers.ts';

/**
 * Date utilities for consistent formatting
 */
export class DateUtils {
  static toISOString(date: Date | number | string): string {
    if (date instanceof Date) {
      return date.toISOString();
    }
    if (typeof date === 'number') {
      return new Date(date).toISOString();
    }
    if (typeof date === 'string') {
      return new Date(date).toISOString();
    }
    return new Date().toISOString();
  }

  static fromISOString(iso: string): Date {
    return new Date(iso);
  }

  static now(): string {
    return new Date().toISOString();
  }
}

/**
 * ID generation utilities with consistent patterns
 */
export class IdUtils {
  static generateTaskId(): string {
    return generateId('task');
  }

  static generateAgentId(): string {
    return generateId('agent');
  }

  static generateMemoryId(): string {
    return generateId('memory');
  }

  static generateSessionId(): string {
    return generateId('session');
  }
}

/**
 * Status mapping utilities
 */
export class StatusMapper {
  // Map legacy task status to unified status
  static mapTaskStatus(status: string): UnifiedTaskStatus {
    switch (status.toLowerCase()) {
      case 'pending':
        return UnifiedTaskStatus.PENDING;
      case 'queued':
        return UnifiedTaskStatus.QUEUED;
      case 'assigned':
        return UnifiedTaskStatus.ASSIGNED;
      case 'running':
      case 'in_progress': // Legacy alias
        return UnifiedTaskStatus.RUNNING;
      case 'completed':
        return UnifiedTaskStatus.COMPLETED;
      case 'failed':
        return UnifiedTaskStatus.FAILED;
      case 'cancelled':
        return UnifiedTaskStatus.CANCELLED;
      default:
        return UnifiedTaskStatus.PENDING;
    }
  }

  // Map legacy agent type to unified type
  static mapAgentType(type: string): UnifiedAgentType {
    switch (type.toLowerCase()) {
      case 'coordinator':
        return UnifiedAgentType.COORDINATOR;
      case 'researcher':
        return UnifiedAgentType.RESEARCHER;
      case 'implementer':
        return UnifiedAgentType.IMPLEMENTER;
      case 'analyst':
        return UnifiedAgentType.ANALYST;
      case 'custom':
        return UnifiedAgentType.CUSTOM;
      default:
        return UnifiedAgentType.CUSTOM;
    }
  }

  // Map legacy agent status to unified status
  static mapAgentStatus(status: string): UnifiedAgentStatus {
    switch (status.toLowerCase()) {
      case 'active':
        return UnifiedAgentStatus.ACTIVE;
      case 'idle':
        return UnifiedAgentStatus.IDLE;
      case 'terminated':
        return UnifiedAgentStatus.TERMINATED;
      case 'error':
        return UnifiedAgentStatus.ERROR;
      default:
        return UnifiedAgentStatus.IDLE;
    }
  }

  // Map legacy memory entry type to unified type
  static mapMemoryEntryType(type: string): UnifiedMemoryEntryType {
    switch (type.toLowerCase()) {
      case 'observation':
        return UnifiedMemoryEntryType.OBSERVATION;
      case 'insight':
        return UnifiedMemoryEntryType.INSIGHT;
      case 'decision':
        return UnifiedMemoryEntryType.DECISION;
      case 'artifact':
        return UnifiedMemoryEntryType.ARTIFACT;
      case 'error':
        return UnifiedMemoryEntryType.ERROR;
      default:
        return UnifiedMemoryEntryType.OBSERVATION;
    }
  }
}

/**
 * Task transformation utilities
 */
export class TaskTransformer {
  /**
   * Convert legacy Task to UnifiedTask
   */
  static toUnified(task: Task): UnifiedTask {
    const now = DateUtils.now();
    
    return {
      id: task.id,
      type: task.type,
      description: task.description,
      priority: task.priority,
      dependencies: task.dependencies || [],
      assignedAgent: task.assignedAgent,
      status: StatusMapper.mapTaskStatus(task.status),
      progress: 0, // Default progress for legacy tasks
      input: task.input || {},
      output: task.output,
      error: task.error ? {
        message: task.error.message,
        code: task.error.name,
        stack: task.error.stack,
        timestamp: now,
      } : undefined,
      createdAt: DateUtils.toISOString(task.createdAt),
      startedAt: task.startedAt ? DateUtils.toISOString(task.startedAt) : undefined,
      completedAt: task.completedAt ? DateUtils.toISOString(task.completedAt) : undefined,
      lastUpdated: now,
      metadata: task.metadata || {},
      tags: [], // Default empty tags for legacy tasks
      attempts: 0, // Default attempts for legacy tasks
      maxRetries: 3, // Default max retries
    };
  }

  /**
   * Convert UnifiedTask to legacy Task
   */
  static fromUnified(unifiedTask: UnifiedTask): Task {
    return {
      id: unifiedTask.id,
      type: unifiedTask.type,
      description: unifiedTask.description,
      priority: unifiedTask.priority,
      dependencies: unifiedTask.dependencies,
      assignedAgent: unifiedTask.assignedAgent,
      status: unifiedTask.status as TaskStatus, // Cast to legacy type
      input: unifiedTask.input,
      output: unifiedTask.output,
      error: unifiedTask.error ? new Error(unifiedTask.error.message) : undefined,
      createdAt: DateUtils.fromISOString(unifiedTask.createdAt),
      startedAt: unifiedTask.startedAt ? DateUtils.fromISOString(unifiedTask.startedAt) : undefined,
      completedAt: unifiedTask.completedAt ? DateUtils.fromISOString(unifiedTask.completedAt) : undefined,
      metadata: unifiedTask.metadata,
    };
  }

  /**
   * Create a new UnifiedTask from basic parameters
   */
  static create(params: {
    type: string;
    description: string;
    priority?: number;
    dependencies?: string[];
    input?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    tags?: string[];
    maxRetries?: number;
  }): UnifiedTask {
    const now = DateUtils.now();
    
    return {
      id: IdUtils.generateTaskId(),
      type: params.type,
      description: params.description,
      priority: params.priority || 50,
      dependencies: params.dependencies || [],
      status: UnifiedTaskStatus.PENDING,
      progress: 0,
      input: params.input || {},
      createdAt: now,
      lastUpdated: now,
      metadata: params.metadata || {},
      tags: params.tags || [],
      attempts: 0,
      maxRetries: params.maxRetries || 3,
    };
  }
}

/**
 * Agent transformation utilities
 */
export class AgentTransformer {
  /**
   * Convert legacy AgentProfile to UnifiedAgentProfile
   */
  static toUnified(agent: AgentProfile): UnifiedAgentProfile {
    const now = DateUtils.now();
    
    return {
      id: agent.id,
      name: agent.name,
      type: StatusMapper.mapAgentType(agent.type),
      capabilities: agent.capabilities || [],
      systemPrompt: agent.systemPrompt,
      maxConcurrentTasks: agent.maxConcurrentTasks,
      priority: agent.priority,
      environment: agent.environment || {},
      workingDirectory: agent.workingDirectory,
      shell: agent.shell,
      status: UnifiedAgentStatus.IDLE, // Default status for legacy agents
      createdAt: now, // Use current time if not available in legacy
      lastActivity: now,
      metadata: agent.metadata || {},
      tags: [], // Default empty tags for legacy agents
    };
  }

  /**
   * Convert UnifiedAgentProfile to legacy AgentProfile
   */
  static fromUnified(unifiedAgent: UnifiedAgentProfile): AgentProfile {
    return {
      id: unifiedAgent.id,
      name: unifiedAgent.name,
      type: unifiedAgent.type as AgentProfile['type'], // Cast to legacy type
      capabilities: unifiedAgent.capabilities,
      systemPrompt: unifiedAgent.systemPrompt,
      maxConcurrentTasks: unifiedAgent.maxConcurrentTasks,
      priority: unifiedAgent.priority,
      environment: unifiedAgent.environment,
      workingDirectory: unifiedAgent.workingDirectory,
      shell: unifiedAgent.shell,
      metadata: unifiedAgent.metadata,
    };
  }

  /**
   * Create a new UnifiedAgentProfile from basic parameters
   */
  static create(params: {
    name: string;
    type: UnifiedAgentType;
    capabilities: string[];
    systemPrompt: string;
    maxConcurrentTasks?: number;
    priority?: number;
    environment?: Record<string, string>;
    workingDirectory?: string;
    shell?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): UnifiedAgentProfile {
    const now = DateUtils.now();
    
    return {
      id: IdUtils.generateAgentId(),
      name: params.name,
      type: params.type,
      capabilities: params.capabilities,
      systemPrompt: params.systemPrompt,
      maxConcurrentTasks: params.maxConcurrentTasks || 1,
      priority: params.priority || 50,
      environment: params.environment || {},
      workingDirectory: params.workingDirectory,
      shell: params.shell,
      status: UnifiedAgentStatus.IDLE,
      createdAt: now,
      lastActivity: now,
      metadata: params.metadata || {},
      tags: params.tags || [],
    };
  }
}

/**
 * Memory entry transformation utilities
 */
export class MemoryTransformer {
  /**
   * Convert legacy MemoryEntry to UnifiedMemoryEntry
   */
  static toUnified(entry: MemoryEntry): UnifiedMemoryEntry {
    const now = DateUtils.now();
    
    return {
      id: entry.id,
      agentId: entry.agentId,
      sessionId: entry.sessionId,
      type: StatusMapper.mapMemoryEntryType(entry.type),
      content: entry.content,
      context: entry.context || {},
      timestamp: DateUtils.toISOString(entry.timestamp),
      createdAt: DateUtils.toISOString(entry.timestamp), // Use timestamp as createdAt
      updatedAt: now,
      version: entry.version,
      parentId: entry.parentId,
      metadata: entry.metadata || {},
      tags: entry.tags || [],
    };
  }

  /**
   * Convert UnifiedMemoryEntry to legacy MemoryEntry
   */
  static fromUnified(unifiedEntry: UnifiedMemoryEntry): MemoryEntry {
    return {
      id: unifiedEntry.id,
      agentId: unifiedEntry.agentId,
      sessionId: unifiedEntry.sessionId,
      type: unifiedEntry.type as MemoryEntry['type'], // Cast to legacy type
      content: unifiedEntry.content,
      context: unifiedEntry.context,
      timestamp: DateUtils.fromISOString(unifiedEntry.timestamp),
      tags: unifiedEntry.tags,
      version: unifiedEntry.version,
      parentId: unifiedEntry.parentId,
      metadata: unifiedEntry.metadata,
    };
  }

  /**
   * Create a new UnifiedMemoryEntry from basic parameters
   */
  static create(params: {
    agentId: string;
    sessionId: string;
    type: UnifiedMemoryEntryType;
    content: string;
    context?: Record<string, unknown>;
    parentId?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
    namespace?: string;
  }): UnifiedMemoryEntry {
    const now = DateUtils.now();
    
    return {
      id: IdUtils.generateMemoryId(),
      agentId: params.agentId,
      sessionId: params.sessionId,
      type: params.type,
      content: params.content,
      context: params.context || {},
      timestamp: now,
      createdAt: now,
      updatedAt: now,
      version: 1,
      parentId: params.parentId,
      metadata: params.metadata || {},
      tags: params.tags || [],
      namespace: params.namespace,
    };
  }
}

/**
 * Batch transformation utilities
 */
export class BatchTransformer {
  /**
   * Transform multiple tasks to unified format
   */
  static tasksToUnified(tasks: Task[]): UnifiedTask[] {
    return tasks.map(task => TaskTransformer.toUnified(task));
  }

  /**
   * Transform multiple agents to unified format
   */
  static agentsToUnified(agents: AgentProfile[]): UnifiedAgentProfile[] {
    return agents.map(agent => AgentTransformer.toUnified(agent));
  }

  /**
   * Transform multiple memory entries to unified format
   */
  static memoryEntriesToUnified(entries: MemoryEntry[]): UnifiedMemoryEntry[] {
    return entries.map(entry => MemoryTransformer.toUnified(entry));
  }
}

/**
 * Validation utilities for transformed data
 */
export class TransformationValidator {
  /**
   * Validate and fix common transformation issues
   */
  static validateAndFixTask(task: Partial<UnifiedTask>): UnifiedTask {
    const now = DateUtils.now();
    
    return {
      id: task.id || IdUtils.generateTaskId(),
      type: task.type || 'unknown',
      description: task.description || 'No description provided',
      priority: Math.max(0, Math.min(100, task.priority || 50)),
      dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
      assignedAgent: task.assignedAgent,
      status: task.status || UnifiedTaskStatus.PENDING,
      progress: Math.max(0, Math.min(100, task.progress || 0)),
      input: task.input || {},
      output: task.output,
      error: task.error,
      createdAt: task.createdAt || now,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      lastUpdated: task.lastUpdated || now,
      metadata: task.metadata || {},
      tags: Array.isArray(task.tags) ? task.tags : [],
      attempts: Math.max(0, task.attempts || 0),
      maxRetries: Math.max(0, task.maxRetries || 3),
      sessionId: task.sessionId,
    };
  }

  /**
   * Validate and fix common agent transformation issues
   */
  static validateAndFixAgent(agent: Partial<UnifiedAgentProfile>): UnifiedAgentProfile {
    const now = DateUtils.now();
    
    return {
      id: agent.id || IdUtils.generateAgentId(),
      name: agent.name || 'Unnamed Agent',
      type: agent.type || UnifiedAgentType.CUSTOM,
      capabilities: Array.isArray(agent.capabilities) ? agent.capabilities : [],
      systemPrompt: agent.systemPrompt || 'You are a helpful AI agent.',
      maxConcurrentTasks: Math.max(1, agent.maxConcurrentTasks || 1),
      priority: Math.max(0, Math.min(100, agent.priority || 50)),
      environment: agent.environment || {},
      workingDirectory: agent.workingDirectory,
      shell: agent.shell,
      status: agent.status || UnifiedAgentStatus.IDLE,
      createdAt: agent.createdAt || now,
      lastActivity: agent.lastActivity || now,
      metadata: agent.metadata || {},
      tags: Array.isArray(agent.tags) ? agent.tags : [],
      currentSession: agent.currentSession,
      terminalId: agent.terminalId,
    };
  }
}