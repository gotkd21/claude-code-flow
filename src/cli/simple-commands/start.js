// start.js - Start orchestration system command
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function startCommand(args, flags) {
  console.log('✅ Starting Claude-Flow orchestration system...');
  
  try {
    // Find Deno executable
    const denoPath = await findDeno();
    if (!denoPath) {
      console.error('❌ Error: Deno is required but not found');
      console.error('Please install Deno: https://deno.land/manual/getting_started/installation');
      return false;
    }

    // Build command line arguments for the TypeScript start command
    const startScriptPath = path.join(__dirname, '../../cli/main.ts');
    const denoArgs = ['run', '--allow-all', '--quiet', startScriptPath, 'start'];
    
    // Add flags
    if (flags.daemon) {
      denoArgs.push('--daemon');
    }
    if (flags.port) {
      denoArgs.push('--port', flags.port.toString());
    }
    if (flags.mcpTransport) {
      denoArgs.push('--mcp-transport', flags.mcpTransport);
    }
    
    // Add any additional arguments
    if (args && args.length > 0) {
      denoArgs.push(...args);
    }

    console.log('🚀 Invoking TypeScript orchestrator...');
    
    // Create PID file directory
    const pidDir = path.join(__dirname, '../../../', '.claude-flow');
    const fs = await import('node:fs');
    if (!fs.existsSync(pidDir)) {
      fs.mkdirSync(pidDir, { recursive: true });
    }
    
    // Spawn the TypeScript start command
    const child = spawn(denoPath, denoArgs, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../../../')
    });
    
    // Write PID file when process starts
    const pidFile = path.join(pidDir, 'orchestrator.pid');
    
    // Wait a moment for the process to start, then write PID
    setTimeout(() => {
      if (child.pid) {
        fs.writeFileSync(pidFile, child.pid.toString());
        console.log(`📝 PID file created: ${child.pid}`);
      }
    }, 100);

    // Handle process events
    child.on('error', (err) => {
      console.error('❌ Failed to start orchestrator:', err.message);
      process.exit(1);
    });

    child.on('close', (code) => {
      // Clean up PID file
      try {
        fs.unlinkSync(pidFile);
      } catch (err) {
        // PID file might already be removed
      }
      
      if (code !== 0) {
        console.error(`❌ Orchestrator exited with code ${code}`);
        process.exit(code);
      }
    });

    // Return a promise that resolves when the child process ends
    return new Promise((resolve) => {
      child.on('close', (code) => {
        resolve(code === 0);
      });
    });

  } catch (error) {
    console.error('❌ Error starting orchestrator:', error.message);
    return false;
  }
}

async function findDeno() {
  // Try different locations for Deno
  const possiblePaths = [
    'deno', // Global deno in PATH
    path.join(os.homedir(), '.deno', 'bin', 'deno'), // User installation
    '/usr/local/bin/deno', // System installation
    '/opt/homebrew/bin/deno' // Homebrew on Apple Silicon
  ];

  const { execSync } = await import('node:child_process');
  
  for (const denoPath of possiblePaths) {
    try {
      execSync(`${denoPath} --version`, { stdio: 'ignore' });
      return denoPath;
    } catch {
      continue;
    }
  }
  
  return null;
}