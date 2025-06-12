/**
 * MCP (Model Context Protocol) client implementation
 */

import {
  MCPConfig,
  MCPRequest,
  MCPResponse,
  MCPNotification,
  MCPInitializeParams,
  MCPInitializeResult,
  MCPProtocolVersion,
  MCPCapabilities,
  MCPTool,
  MCPPrompt,
  MCPResource,
  MCPToolCall,
  MCPToolResult,
  MCPSession,
} from '../utils/types.ts';
import { ILogger } from '../core/logger.ts';
import { MCPError as MCPErrorClass, MCPConnectionError, MCPTimeoutError } from '../utils/errors.ts';

export interface IMCPClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  initialize(params: MCPInitializeParams): Promise<MCPInitializeResult>;
  listTools(): Promise<MCPTool[]>;
  listPrompts(): Promise<MCPPrompt[]>;
  listResources(): Promise<MCPResource[]>;
  callTool(call: MCPToolCall): Promise<MCPToolResult>;
  getPrompt(name: string, args?: Record<string, unknown>): Promise<{ content: string }>;
  getResource(uri: string): Promise<{ content: string; mimeType?: string }>;
  sendNotification(notification: MCPNotification): Promise<void>;
  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' | 'initializing' | 'ready';
  getServerCapabilities(): MCPCapabilities | undefined;
  getHealthStatus(): Promise<{
    healthy: boolean;
    error?: string;
    metrics?: Record<string, number>;
  }>;
}

export interface MCPClientConfig {
  serverCommand: string;
  serverArgs?: string[];
  serverEnv?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  autoReconnect?: boolean;
  capabilities?: MCPCapabilities;
  clientInfo?: {
    name: string;
    version: string;
  };
}

/**
 * MCP client implementation for connecting to MCP servers
 */
export class MCPClient implements IMCPClient {
  private process?: Deno.ChildProcess | null;
  private stdin?: WritableStreamDefaultWriter<Uint8Array> | null;
  private stdout?: ReadableStreamDefaultReader<Uint8Array> | null;
  private stderr?: ReadableStreamDefaultReader<Uint8Array> | null;
  
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'initializing' | 'ready' = 'disconnected';
  private serverCapabilities?: MCPCapabilities;
  private serverInfo?: { name: string; version: string };
  private protocolVersion?: MCPProtocolVersion;
  
  private pendingRequests = new Map<string | number, {
    resolve: (response: MCPResponse) => void;
    reject: (error: Error) => void;
    timeout: number;
  }>();
  
  private nextRequestId = 1;
  private buffer = '';
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();
  
  private readonly supportedProtocolVersion: MCPProtocolVersion = {
    major: 2024,
    minor: 11,
    patch: 5,
  };

  private readonly defaultCapabilities: MCPCapabilities = {
    logging: {
      level: 'info',
    },
    tools: {
      listChanged: true,
    },
    resources: {
      listChanged: false,
      subscribe: false,
    },
    prompts: {
      listChanged: false,
    },
  };

  private readonly defaultClientInfo = {
    name: 'Claude-Flow MCP Client',
    version: '1.0.0',
  };

  constructor(
    private config: MCPClientConfig,
    private logger: ILogger,
  ) {}

  async connect(): Promise<void> {
    if (this.connectionStatus !== 'disconnected') {
      throw new MCPConnectionError('Client already connected or connecting');
    }

    this.connectionStatus = 'connecting';
    this.logger.info('Connecting to MCP server', {
      command: this.config.serverCommand,
      args: this.config.serverArgs,
    });

    try {
      // Start server process
      const commandOptions: Deno.CommandOptions = {
        args: this.config.serverArgs || [],
        stdin: 'piped',
        stdout: 'piped',
        stderr: 'piped',
      };
      
      if (this.config.serverEnv) {
        commandOptions.env = this.config.serverEnv;
      }
      
      const command = new Deno.Command(this.config.serverCommand, commandOptions);

      this.process = command.spawn();

      // Get stream readers/writers
      this.stdin = this.process.stdin.getWriter();
      this.stdout = this.process.stdout.getReader();
      this.stderr = this.process.stderr.getReader();

      // Start reading stdout and stderr
      this.startReading();

      this.connectionStatus = 'connected';
      this.logger.info('MCP server process started');
    } catch (error) {
      this.connectionStatus = 'disconnected';
      this.logger.error('Failed to start MCP server process', error);
      throw new MCPConnectionError('Failed to start MCP server process', { error });
    }
  }

  async disconnect(): Promise<void> {
    if (this.connectionStatus === 'disconnected') {
      return;
    }

    this.logger.info('Disconnecting from MCP server');
    this.connectionStatus = 'disconnected';

    try {
      // Cancel all pending requests
      for (const [id, request] of this.pendingRequests) {
        request.reject(new MCPConnectionError('Connection closed'));
      }
      this.pendingRequests.clear();

      // Close streams
      if (this.stdin) {
        await this.stdin.close();
        this.stdin = null;
      }

      if (this.stdout) {
        await this.stdout.cancel();
        this.stdout = null;
      }

      if (this.stderr) {
        await this.stderr.cancel();
        this.stderr = null;
      }

      // Terminate process
      if (this.process) {
        try {
          // Check if process is still running before trying to kill it
          const status = await Promise.race([
            this.process.status,
            new Promise(resolve => setTimeout(() => resolve(null), 100))
          ]);
          
          if (status === null) {
            // Process is still running, try to terminate it
            this.process.kill('SIGTERM');
            
            // Wait for process to exit or force kill after timeout
            const timeout = setTimeout(() => {
              if (this.process) {
                try {
                  this.process.kill('SIGKILL');
                } catch {
                  // Ignore error if process already terminated
                }
              }
            }, 5000);

            try {
              await this.process.status;
            } finally {
              clearTimeout(timeout);
            }
          }
        } catch (error) {
          // Process might already be terminated, log but don't throw
          this.logger.debug('Process termination error (process may already be terminated)', error);
        } finally {
          this.process = null;
        }
      }

      this.logger.info('Disconnected from MCP server');
    } catch (error) {
      this.logger.error('Error during disconnect', error);
      throw error;
    }
  }

  async initialize(params?: MCPInitializeParams): Promise<MCPInitializeResult> {
    if (this.connectionStatus !== 'connected') {
      throw new MCPConnectionError('Client not connected');
    }

    this.connectionStatus = 'initializing';
    this.logger.info('Initializing MCP session');

    const initParams: MCPInitializeParams = params || {
      protocolVersion: this.supportedProtocolVersion,
      capabilities: this.config.capabilities || this.defaultCapabilities,
      clientInfo: this.config.clientInfo || this.defaultClientInfo,
    };

    try {
      const response = await this.sendRequest({
        jsonrpc: '2.0',
        id: this.getNextRequestId(),
        method: 'initialize',
        params: initParams,
      });

      if (response.error) {
        throw new MCPErrorClass(`Initialization failed: ${response.error.message}`, response.error);
      }

      const result = response.result as MCPInitializeResult;
      
      this.protocolVersion = result.protocolVersion;
      this.serverCapabilities = result.capabilities;
      this.serverInfo = result.serverInfo;
      this.connectionStatus = 'ready';

      this.logger.info('MCP session initialized', {
        serverInfo: result.serverInfo,
        protocolVersion: result.protocolVersion,
        capabilities: result.capabilities,
      });

      return result;
    } catch (error) {
      this.connectionStatus = 'connected';
      this.logger.error('Failed to initialize MCP session', error);
      throw error;
    }
  }

  async listTools(): Promise<MCPTool[]> {
    this.ensureReady();

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/list',
    });

    if (response.error) {
      throw new MCPErrorClass(`Failed to list tools: ${response.error.message}`, response.error);
    }

    return (response.result as { tools: MCPTool[] }).tools || [];
  }

  async listPrompts(): Promise<MCPPrompt[]> {
    this.ensureReady();

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'prompts/list',
    });

    if (response.error) {
      throw new MCPErrorClass(`Failed to list prompts: ${response.error.message}`, response.error);
    }

    return (response.result as { prompts: MCPPrompt[] }).prompts || [];
  }

  async listResources(): Promise<MCPResource[]> {
    this.ensureReady();

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'resources/list',
    });

    if (response.error) {
      throw new MCPErrorClass(`Failed to list resources: ${response.error.message}`, response.error);
    }

    return (response.result as { resources: MCPResource[] }).resources || [];
  }

  async callTool(call: MCPToolCall): Promise<MCPToolResult> {
    this.ensureReady();

    this.logger.debug('Calling tool', { name: call.name, arguments: call.arguments });

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/call',
      params: {
        name: call.name,
        arguments: call.arguments || {},
      },
    });

    if (response.error) {
      throw new MCPErrorClass(`Tool call failed: ${response.error.message}`, response.error);
    }

    return response.result as MCPToolResult;
  }

  async getPrompt(name: string, args?: Record<string, unknown>): Promise<{ content: string }> {
    this.ensureReady();

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'prompts/get',
      params: {
        name,
        arguments: args || {},
      },
    });

    if (response.error) {
      throw new MCPErrorClass(`Failed to get prompt: ${response.error.message}`, response.error);
    }

    return response.result as { content: string };
  }

  async getResource(uri: string): Promise<{ content: string; mimeType?: string }> {
    this.ensureReady();

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'resources/read',
      params: {
        uri,
      },
    });

    if (response.error) {
      throw new MCPErrorClass(`Failed to get resource: ${response.error.message}`, response.error);
    }

    return response.result as { content: string; mimeType?: string };
  }

  async sendNotification(notification: MCPNotification): Promise<void> {
    if (this.connectionStatus === 'disconnected' || !this.stdin) {
      throw new MCPConnectionError('Client not connected');
    }

    try {
      const json = JSON.stringify(notification);
      const data = this.encoder.encode(json + '\n');
      
      await this.stdin.write(data);
      
      this.logger.debug('Notification sent', {
        method: notification.method,
        params: notification.params,
      });
    } catch (error) {
      this.logger.error('Failed to send notification', { notification, error });
      throw new MCPConnectionError('Failed to send notification', { error });
    }
  }

  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' | 'initializing' | 'ready' {
    return this.connectionStatus;
  }

  getServerCapabilities(): MCPCapabilities | undefined {
    return this.serverCapabilities;
  }

  async getHealthStatus(): Promise<{
    healthy: boolean;
    error?: string;
    metrics?: Record<string, number>;
  }> {
    const metrics = {
      pendingRequests: this.pendingRequests.size,
      bufferSize: this.buffer.length,
      connectionStatus: this.connectionStatus === 'ready' ? 1 : 0,
    };

    if (this.connectionStatus === 'disconnected') {
      return {
        healthy: false,
        error: 'Client disconnected',
        metrics,
      };
    }

    try {
      // Try to call a simple tool to test connectivity
      if (this.connectionStatus === 'ready') {
        await this.sendRequest({
          jsonrpc: '2.0',
          id: this.getNextRequestId(),
          method: 'ping',
        }, 1000); // Short timeout for health check
      }

      return {
        healthy: this.connectionStatus === 'ready',
        metrics,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics,
      };
    }
  }

  private async sendRequest(request: MCPRequest, timeoutMs?: number): Promise<MCPResponse> {
    if (this.connectionStatus === 'disconnected' || !this.stdin) {
      throw new MCPConnectionError('Client not connected');
    }

    const timeout = timeoutMs || this.config.timeout || 30000;
    
    return new Promise((resolve, reject) => {
      // Store pending request
      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.pendingRequests.delete(request.id);
          reject(new MCPTimeoutError(`Request timeout after ${timeout}ms`));
        }, timeout),
      });

      // Send request
      const json = JSON.stringify(request);
      const data = this.encoder.encode(json + '\n');
      
      this.stdin!.write(data).catch((error) => {
        this.pendingRequests.delete(request.id);
        reject(new MCPConnectionError('Failed to send request', { error }));
      });

      this.logger.debug('Request sent', {
        id: request.id,
        method: request.method,
        params: request.params,
      });
    });
  }

  private async startReading(): Promise<void> {
    // Start reading stdout
    if (this.stdout) {
      this.readStream(this.stdout, 'stdout');
    }

    // Start reading stderr
    if (this.stderr) {
      this.readStream(this.stderr, 'stderr');
    }
  }

  private async readStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    streamName: string,
  ): Promise<void> {
    try {
      while (this.connectionStatus !== 'disconnected') {
        const { done, value } = await reader.read();
        
        if (done) {
          this.logger.info(`${streamName} stream closed`);
          break;
        }

        if (streamName === 'stdout') {
          // Process stdout as JSON-RPC messages
          this.buffer += this.decoder.decode(value, { stream: true });
          await this.processBuffer();
        } else {
          // Log stderr output
          const text = this.decoder.decode(value, { stream: true });
          this.logger.debug(`Server stderr: ${text.trim()}`);
        }
      }
    } catch (error) {
      if (this.connectionStatus !== 'disconnected') {
        this.logger.error(`Error reading ${streamName}`, error);
      }
    }
  }

  private async processBuffer(): Promise<void> {
    let newlineIndex: number;
    
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line.length === 0) {
        continue;
      }

      try {
        await this.processMessage(line);
      } catch (error) {
        this.logger.error('Error processing message', { line, error });
      }
    }
  }

  private async processMessage(line: string): Promise<void> {
    let message: any;

    try {
      message = JSON.parse(line);
      
      if (!message.jsonrpc || message.jsonrpc !== '2.0') {
        throw new Error('Invalid JSON-RPC version');
      }
    } catch (error) {
      this.logger.error('Failed to parse message', { line, error });
      return;
    }

    // Check if this is a response to a pending request
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);
      clearTimeout(pending.timeout);
      
      pending.resolve(message as MCPResponse);
      return;
    }

    // Check if this is a notification
    if (message.method && message.id === undefined) {
      await this.handleNotification(message as MCPNotification);
      return;
    }

    this.logger.warn('Received unexpected message', { message });
  }

  private async handleNotification(notification: MCPNotification): Promise<void> {
    this.logger.debug('Received notification', {
      method: notification.method,
      params: notification.params,
    });

    // Handle built-in notifications
    switch (notification.method) {
      case 'notifications/tools/list_changed':
        this.logger.info('Server tools list changed');
        break;
      
      case 'notifications/prompts/list_changed':
        this.logger.info('Server prompts list changed');
        break;
      
      case 'notifications/resources/list_changed':
        this.logger.info('Server resources list changed');
        break;
      
      default:
        this.logger.debug('Unknown notification method', { method: notification.method });
    }
  }

  private ensureReady(): void {
    if (this.connectionStatus !== 'ready') {
      throw new MCPConnectionError(`Client not ready, current status: ${this.connectionStatus}`);
    }
  }

  private getNextRequestId(): number {
    return this.nextRequestId++;
  }
}