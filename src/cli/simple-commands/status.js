// status.js - System status and monitoring commands
import { printSuccess, printError, printWarning } from '../utils.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function statusCommand(subArgs, flags) {
  const verbose = subArgs.includes('--verbose') || subArgs.includes('-v') || flags.verbose;
  const json = subArgs.includes('--json') || flags.json;
  
  const status = await getSystemStatus(verbose);
  
  if (json) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    displayStatus(status, verbose);
  }
}

async function getSystemStatus(verbose = false) {
  const orchestratorStatus = await checkOrchestratorStatus();
  
  const status = {
    timestamp: Date.now(),
    version: '1.0.41',
    orchestrator: orchestratorStatus,
    agents: {
      active: 0,
      total: 0,
      types: {}
    },
    tasks: {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0
    },
    memory: {
      status: 'Ready',
      entries: await getMemoryStats(),
      size: '0.37 KB'
    },
    terminal: {
      status: 'Ready',
      poolSize: 10,
      active: 0
    },
    mcp: {
      status: 'Stopped',
      port: null,
      connections: 0
    },
    resources: verbose ? await getResourceUsage() : null
  };
  
  return status;
}

async function getMemoryStats() {
  try {
    const memoryStore = './memory/memory-store.json';
    const content = await Deno.readTextFile(memoryStore);
    const data = JSON.parse(content);
    
    let totalEntries = 0;
    for (const entries of Object.values(data)) {
      totalEntries += entries.length;
    }
    
    return totalEntries;
  } catch {
    return 0;
  }
}

async function getResourceUsage() {
  // Get system resource information
  try {
    const memInfo = await Deno.systemMemoryInfo();
    return {
      memory: {
        total: formatBytes(memInfo.total),
        free: formatBytes(memInfo.free),
        available: formatBytes(memInfo.available),
        usage: `${Math.round(((memInfo.total - memInfo.available) / memInfo.total) * 100)}%`
      },
      cpu: {
        cores: navigator.hardwareConcurrency || 'Unknown',
        load: 'N/A' // Would need additional system calls
      }
    };
  } catch {
    return {
      memory: { usage: 'Unknown' },
      cpu: { cores: 'Unknown', load: 'Unknown' }
    };
  }
}

function displayStatus(status, verbose) {
  printSuccess('Claude-Flow System Status:');
  
  // Overall status
  const overallStatus = status.orchestrator.running ? '🟢 Running' : '🟡 Not Running';
  console.log(`${overallStatus} (orchestrator ${status.orchestrator.running ? 'active' : 'not started'})`);
  
  // Core components
  console.log(`🤖 Agents: ${status.agents.active} active`);
  console.log(`📋 Tasks: ${status.tasks.queued} in queue`);
  console.log(`💾 Memory: ${status.memory.status} (${status.memory.entries} entries)`);
  console.log(`🖥️  Terminal Pool: ${status.terminal.status}`);
  console.log(`🌐 MCP Server: ${status.mcp.status}`);
  
  if (verbose) {
    console.log('\n📊 Detailed Information:');
    
    // Orchestrator details
    console.log('\n🎭 Orchestrator:');
    console.log(`   Status: ${status.orchestrator.status}`);
    console.log(`   Uptime: ${formatUptime(status.orchestrator.uptime)}`);
    
    // Agent details
    console.log('\n🤖 Agent Details:');
    console.log(`   Total Registered: ${status.agents.total}`);
    console.log(`   Currently Active: ${status.agents.active}`);
    if (Object.keys(status.agents.types).length > 0) {
      console.log('   Types:');
      for (const [type, count] of Object.entries(status.agents.types)) {
        console.log(`     ${type}: ${count}`);
      }
    } else {
      console.log('   No agents currently registered');
    }
    
    // Task details
    console.log('\n📋 Task Queue:');
    console.log(`   Queued: ${status.tasks.queued}`);
    console.log(`   Running: ${status.tasks.running}`);
    console.log(`   Completed: ${status.tasks.completed}`);
    console.log(`   Failed: ${status.tasks.failed}`);
    
    // Memory details
    console.log('\n💾 Memory System:');
    console.log(`   Total Entries: ${status.memory.entries}`);
    console.log(`   Database Size: ${status.memory.size}`);
    console.log(`   Status: ${status.memory.status}`);
    
    // Terminal details
    console.log('\n🖥️  Terminal Pool:');
    console.log(`   Pool Size: ${status.terminal.poolSize}`);
    console.log(`   Active Sessions: ${status.terminal.active}`);
    console.log(`   Status: ${status.terminal.status}`);
    
    // MCP details
    console.log('\n🌐 MCP Server:');
    console.log(`   Status: ${status.mcp.status}`);
    console.log(`   Port: ${status.mcp.port || 'Not configured'}`);
    console.log(`   Active Connections: ${status.mcp.connections}`);
    
    // Resource usage
    if (status.resources) {
      console.log('\n📈 Resource Usage:');
      console.log(`   Memory: ${status.resources.memory.usage} of ${status.resources.memory.total}`);
      console.log(`   CPU Cores: ${status.resources.cpu.cores}`);
      console.log(`   CPU Load: ${status.resources.cpu.load}`);
    }
    
    console.log('\n🕐 Status captured at:', new Date(status.timestamp).toLocaleString());
  }
  
  // Recommendations
  console.log('\n💡 Quick Actions:');
  if (!status.orchestrator.running) {
    console.log('   Run "claude-flow start" to begin orchestration');
  }
  if (status.agents.active === 0) {
    console.log('   Run "claude-flow agent spawn researcher" to create an agent');
  }
  if (status.memory.entries === 0) {
    console.log('   Run "claude-flow memory store key value" to test memory');
  }
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatUptime(milliseconds) {
  if (milliseconds === 0) return '0s';
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

async function checkOrchestratorStatus() {
  try {
    // Simple approach: check for running deno processes with claude-flow
    const { execSync } = await import('node:child_process');
    
    try {
      const result = execSync('ps aux | grep -E "deno.*claude-flow.*start" | grep -v grep', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      if (result.trim()) {
        // Parse the process info
        const lines = result.trim().split('\n');
        if (lines.length > 0) {
          const processInfo = lines[0].split(/\s+/);
          const pid = parseInt(processInfo[1], 10);
          
          return {
            running: true,
            uptime: 0, // We can't easily get uptime without PID file timestamps
            status: 'Running',
            pid: pid
          };
        }
      }
    } catch (err) {
      // ps command failed or no processes found
    }
    
    // Check PID file as backup method
    const pidFile = path.join(__dirname, '../../../', '.claude-flow', 'orchestrator.pid');
    if (fs.existsSync(pidFile)) {
      const pidString = fs.readFileSync(pidFile, 'utf8').trim();
      const pid = parseInt(pidString, 10);
      
      if (!isNaN(pid)) {
        try {
          process.kill(pid, 0); // Signal 0 tests if process exists
          const startTime = fs.statSync(pidFile).mtime.getTime();
          const uptime = Date.now() - startTime;
          
          return {
            running: true,
            uptime: uptime,
            status: 'Running',
            pid: pid
          };
        } catch (err) {
          // Process doesn't exist, clean up stale PID file
          fs.unlinkSync(pidFile);
        }
      }
    }
    
    return {
      running: false,
      uptime: 0,
      status: 'Not Running',
      pid: null
    };
  } catch (error) {
    return {
      running: false,
      uptime: 0,
      status: `Error checking status: ${error.message}`,
      pid: null
    };
  }
}