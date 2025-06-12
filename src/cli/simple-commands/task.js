// task.js - Task management commands
import { printSuccess, printError, printWarning } from '../utils.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function taskCommand(subArgs, flags) {
  const taskCmd = subArgs[0];
  
  switch (taskCmd) {
    case 'create':
      await createTask(subArgs, flags);
      break;
      
    case 'list':
      await listTasks(subArgs, flags);
      break;
      
    case 'status':
      await showTaskStatus(subArgs, flags);
      break;
      
    case 'cancel':
      await cancelTask(subArgs, flags);
      break;
      
    case 'workflow':
      await executeWorkflow(subArgs, flags);
      break;
      
    case 'coordination':
      await manageCoordination(subArgs, flags);
      break;
      
    default:
      showTaskHelp();
  }
}

async function createTask(subArgs, flags) {
  const taskType = subArgs[1];
  const description = subArgs.slice(2).join(' ');
  
  if (!taskType || !description) {
    printError('Usage: task create <type> "<description>"');
    console.log('Types: research, code, analysis, coordination, general');
    return;
  }
  
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const priority = parseInt(getFlag(subArgs, '--priority') || '5', 10);
  
  const task = {
    id: taskId,
    type: taskType,
    description: description,
    priority: priority,
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assignedAgent: null,
    progress: 0,
    results: null,
    error: null
  };
  
  // Store task in memory system
  await storeTask(task);
  
  printSuccess(`Creating ${taskType} task: ${taskId}`);
  console.log(`📋 Description: ${description}`);
  console.log(`⚡ Priority: ${priority}/10`);
  console.log(`🏷️  Type: ${taskType}`);
  console.log('📅 Status: Queued');
  
  // Check if orchestrator is running and notify it
  const orchestratorRunning = await checkOrchestratorRunning();
  if (orchestratorRunning) {
    console.log('✅ Task submitted to running orchestrator');
    await notifyOrchestratorNewTask(task);
  } else {
    console.log('⚠️  Task queued - start orchestrator with: claude-flow start');
  }
}

async function listTasks(subArgs, flags) {
  const filter = getFlag(subArgs, '--filter');
  const verbose = subArgs.includes('--verbose') || subArgs.includes('-v');
  
  printSuccess('Task queue:');
  
  if (filter) {
    console.log(`📊 Filtered by status: ${filter}`);
  }
  
  try {
    const tasks = await loadTasks();
    const filteredTasks = filter ? tasks.filter(task => task.status === filter) : tasks;
    
    if (filteredTasks.length === 0) {
      console.log('📋 No tasks found');
      if (filter) {
        console.log(`   (No tasks with status: ${filter})`);
      }
    } else {
      console.log(`📋 Found ${filteredTasks.length} task(s):\n`);
      
      // Sort by priority (highest first) and creation time
      filteredTasks.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
      
      for (const task of filteredTasks) {
        const statusIcon = getStatusIcon(task.status);
        const priorityStr = '⚡'.repeat(Math.min(task.priority, 5));
        
        console.log(`${statusIcon} ${task.id}`);
        console.log(`   Type: ${task.type}`);
        console.log(`   Description: ${task.description}`);
        console.log(`   Priority: ${priorityStr} (${task.priority}/10)`);
        console.log(`   Status: ${task.status}`);
        console.log(`   Created: ${new Date(task.createdAt).toLocaleString()}`);
        
        if (task.assignedAgent) {
          console.log(`   Agent: ${task.assignedAgent}`);
        }
        
        if (task.progress > 0) {
          console.log(`   Progress: ${task.progress}%`);
        }
        
        if (verbose) {
          console.log(`   Updated: ${new Date(task.updatedAt).toLocaleString()}`);
          if (task.results) {
            console.log(`   Results: ${task.results}`);
          }
          if (task.error) {
            console.log(`   Error: ${task.error}`);
          }
        }
        
        console.log(); // Empty line between tasks
      }
    }
    
    console.log('Task statuses: queued, running, completed, failed, cancelled');
    
    if (verbose) {
      console.log('\nTo create tasks:');
      console.log('  claude-flow task create research "Market analysis"');
      console.log('  claude-flow task create code "Implement API"');
      console.log('  claude-flow task create analysis "Data processing"');
    }
  } catch (error) {
    printError(`Failed to load tasks: ${error.message}`);
  }
}

async function showTaskStatus(subArgs, flags) {
  const taskId = subArgs[1];
  
  if (!taskId) {
    printError('Usage: task status <task-id>');
    return;
  }
  
  printSuccess(`Task status: ${taskId}`);
  console.log('📊 Task details would include:');
  console.log('   Status, progress, assigned agent, execution time, results');
}

async function cancelTask(subArgs, flags) {
  const taskId = subArgs[1];
  
  if (!taskId) {
    printError('Usage: task cancel <task-id>');
    return;
  }
  
  printSuccess(`Cancelling task: ${taskId}`);
  console.log('🛑 Task would be gracefully cancelled');
}

async function executeWorkflow(subArgs, flags) {
  const workflowFile = subArgs[1];
  
  if (!workflowFile) {
    printError('Usage: task workflow <workflow-file>');
    return;
  }
  
  printSuccess(`Executing workflow: ${workflowFile}`);
  console.log('🔄 Workflow execution would include:');
  console.log('   - Parsing workflow definition');
  console.log('   - Creating dependent tasks');
  console.log('   - Orchestrating execution');
  console.log('   - Progress tracking');
}

async function manageCoordination(subArgs, flags) {
  const coordCmd = subArgs[1];
  
  switch (coordCmd) {
    case 'status':
      printSuccess('Task coordination status:');
      console.log('🎯 Coordination engine: Not running');
      console.log('   Active coordinators: 0');
      console.log('   Pending tasks: 0');
      console.log('   Resource utilization: 0%');
      break;
      
    case 'optimize':
      printSuccess('Optimizing task coordination...');
      console.log('⚡ Optimization would include:');
      console.log('   - Task dependency analysis');
      console.log('   - Resource allocation optimization');
      console.log('   - Parallel execution planning');
      break;
      
    default:
      console.log('Coordination commands: status, optimize');
  }
}

function getFlag(args, flagName) {
  const index = args.indexOf(flagName);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
}

function showTaskHelp() {
  console.log('Task commands:');
  console.log('  create <type> "<description>"    Create new task');
  console.log('  list [--filter <status>]        List tasks');
  console.log('  status <id>                      Show task details');
  console.log('  cancel <id>                      Cancel running task');
  console.log('  workflow <file>                  Execute workflow file');
  console.log('  coordination <status|optimize>   Manage coordination');
  console.log();
  console.log('Task Types:');
  console.log('  research      Information gathering and analysis');
  console.log('  code          Software development tasks');
  console.log('  analysis      Data processing and insights');
  console.log('  coordination  Task orchestration and management');
  console.log('  general       General purpose tasks');
  console.log();
  console.log('Options:');
  console.log('  --priority <1-10>                Set task priority');
  console.log('  --filter <status>                Filter by status');
  console.log('  --verbose, -v                    Show detailed output');
  console.log();
  console.log('Examples:');
  console.log('  claude-flow task create research "Market analysis" --priority 8');
  console.log('  claude-flow task list --filter running');
  console.log('  claude-flow task workflow examples/development-workflow.json');
  console.log('  claude-flow task coordination status');
}

// Helper functions for task storage and communication

async function storeTask(task) {
  const tasksFile = path.join(__dirname, '../../../', 'memory', 'claude-flow-data.json');
  
  try {
    // Ensure memory directory exists
    const memoryDir = path.dirname(tasksFile);
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }
    
    // Load existing data
    let data = { tasks: [], agents: [], memory: {} };
    if (fs.existsSync(tasksFile)) {
      const content = fs.readFileSync(tasksFile, 'utf8');
      if (content.trim()) {
        data = JSON.parse(content);
      }
    }
    
    // Initialize tasks array if it doesn't exist
    if (!data.tasks) {
      data.tasks = [];
    }
    
    // Add the new task
    data.tasks.push(task);
    
    // Save back to file
    fs.writeFileSync(tasksFile, JSON.stringify(data, null, 2));
  } catch (error) {
    throw new Error(`Failed to store task: ${error.message}`);
  }
}

async function loadTasks() {
  const tasksFile = path.join(__dirname, '../../../', 'memory', 'claude-flow-data.json');
  
  try {
    if (!fs.existsSync(tasksFile)) {
      return [];
    }
    
    const content = fs.readFileSync(tasksFile, 'utf8');
    if (!content.trim()) {
      return [];
    }
    
    const data = JSON.parse(content);
    return data.tasks || [];
  } catch (error) {
    throw new Error(`Failed to load tasks: ${error.message}`);
  }
}

async function checkOrchestratorRunning() {
  try {
    const { execSync } = await import('node:child_process');
    const result = execSync('ps aux | grep -E "deno.*claude-flow.*start" | grep -v grep', { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return result.trim().length > 0;
  } catch (err) {
    return false;
  }
}

async function notifyOrchestratorNewTask(task) {
  // For now, we'll use the memory system as the communication channel
  // The orchestrator should periodically check for new tasks
  // In a future version, we could use HTTP API or message queues
  
  try {
    // Create a notification file that the orchestrator can watch
    const notifyFile = path.join(__dirname, '../../../', '.claude-flow', 'notifications.json');
    const notifyDir = path.dirname(notifyFile);
    
    if (!fs.existsSync(notifyDir)) {
      fs.mkdirSync(notifyDir, { recursive: true });
    }
    
    let notifications = [];
    if (fs.existsSync(notifyFile)) {
      const content = fs.readFileSync(notifyFile, 'utf8');
      if (content.trim()) {
        notifications = JSON.parse(content);
      }
    }
    
    notifications.push({
      type: 'new_task',
      taskId: task.id,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 100 notifications
    if (notifications.length > 100) {
      notifications = notifications.slice(-100);
    }
    
    fs.writeFileSync(notifyFile, JSON.stringify(notifications, null, 2));
  } catch (error) {
    // Notification failed, but task is still stored
    console.log(`⚠️  Note: Could not notify orchestrator: ${error.message}`);
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'queued': return '⏳';
    case 'running': return '🔄';
    case 'completed': return '✅';
    case 'failed': return '❌';
    case 'cancelled': return '🚫';
    default: return '❓';
  }
}