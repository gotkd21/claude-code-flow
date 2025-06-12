# How to Build Product Features with Claude-Flow

This comprehensive guide demonstrates how to use Claude-Flow to develop a complete product feature from conception to deployment. We'll build a **401(k) Portfolio Rebalancing Feature** for a retirement planning platform.

## Table of Contents
1. [Feature Overview](#feature-overview)
2. [Prerequisites](#prerequisites)
3. [Project Setup](#project-setup)
4. [Agent Configuration](#agent-configuration)
5. [Task Planning & Decomposition](#task-planning--decomposition)
6. [Implementation Workflow](#implementation-workflow)
7. [Testing & Validation](#testing--validation)
8. [Deployment](#deployment)
9. [Monitoring & Maintenance](#monitoring--maintenance)

## Feature Overview

**Feature**: 401(k) Portfolio Rebalancing
**Goal**: Allow users to automatically rebalance their 401(k) portfolios based on target allocations
**Components**: 
- Portfolio analysis engine
- Rebalancing algorithm
- User notification system
- Compliance checks
- Transaction processing

## Prerequisites

### System Requirements
```bash
# Ensure you have Claude-Flow installed and configured
deno --version  # v1.40.0+
claude-flow --version

# Verify core components are working
claude-flow status
```

### Environment Setup
```bash
# 1. Initialize your project workspace
mkdir retirement-platform-rebalancing
cd retirement-platform-rebalancing

# 2. Initialize Claude-Flow configuration
claude-flow init --template=web-application

# 3. Set up environment variables
export CLAUDE_FLOW_PROJECT="retirement-rebalancing"
export CLAUDE_FLOW_LOG_LEVEL="info"
```

## Project Setup

### Step 1: Configure Claude-Flow for Feature Development

```bash
# Create project-specific configuration
claude-flow config create development-config.json
```

**development-config.json**:
```json
{
  "orchestrator": {
    "maxConcurrentAgents": 8,
    "taskQueueSize": 100,
    "healthCheckInterval": 30000
  },
  "memory": {
    "backend": "sqlite",
    "sqlitePath": "./memory/rebalancing-feature.db"
  },
  "coordination": {
    "maxRetries": 3,
    "deadlockDetection": true
  },
  "mcp": {
    "transport": "stdio",
    "enableMetrics": true
  }
}
```

### Step 2: Start Claude-Flow Orchestrator

```bash
# Start the orchestrator with your configuration
claude-flow start --config=development-config.json --daemon

# Verify it's running
claude-flow status
```

## Agent Configuration

### Step 3: Define Specialized Agents

Create agents for different aspects of the feature:

```bash
# 1. Portfolio Analysis Agent
claude-flow agent spawn analyst \
  --name="portfolio-analyzer" \
  --max-tasks=3 \
  --priority=80 \
  --system-prompt="You are a financial portfolio analysis expert. You analyze investment portfolios, calculate allocations, and identify rebalancing opportunities."

# 2. Algorithm Development Agent  
claude-flow agent spawn implementer \
  --name="rebalancing-algorithm" \
  --max-tasks=2 \
  --priority=90 \
  --system-prompt="You are a software engineer specializing in financial algorithms. You implement portfolio rebalancing logic with precision and compliance."

# 3. Frontend Development Agent
claude-flow agent spawn implementer \
  --name="ui-developer" \
  --max-tasks=4 \
  --priority=70 \
  --system-prompt="You are a frontend developer expert in React and financial UIs. You create intuitive interfaces for complex financial operations."

# 4. Testing & Validation Agent
claude-flow agent spawn researcher \
  --name="qa-validator" \
  --max-tasks=5 \
  --priority=85 \
  --system-prompt="You are a QA engineer specialized in financial software testing. You ensure accuracy, security, and compliance in financial calculations."

# 5. Compliance & Security Agent
claude-flow agent spawn analyst \
  --name="compliance-checker" \
  --max-tasks=2 \
  --priority=95 \
  --system-prompt="You are a financial compliance expert. You ensure all features meet regulatory requirements and security standards."
```

### Step 4: Verify Agent Status

```bash
claude-flow agent list
```

## Task Planning & Decomposition

### Step 5: Create Master Feature Task

```bash
claude-flow task create feature-development \
  "Implement 401k Portfolio Rebalancing Feature" \
  --priority=90 \
  --input='{
    "feature_spec": {
      "name": "401k Portfolio Rebalancing", 
      "components": ["analysis", "algorithm", "ui", "notifications", "compliance"],
      "timeline": "2 weeks",
      "compliance_requirements": ["ERISA", "DOL fiduciary rules"]
    }
  }' \
  --metadata='{"project": "retirement-platform", "feature_type": "core"}'
```

### Step 6: Create Component Tasks

```bash
# 1. Portfolio Analysis Tasks
claude-flow task create portfolio-analysis \
  "Analyze user portfolio and calculate current allocations" \
  --priority=80 \
  --dependencies="" \
  --input='{
    "requirements": {
      "data_sources": ["401k_provider_api", "fund_data"],
      "calculations": ["current_allocation", "target_deviation", "rebalancing_need"],
      "output_format": "portfolio_analysis_report"
    }
  }'

# 2. Algorithm Development Tasks  
claude-flow task create rebalancing-algorithm \
  "Develop portfolio rebalancing calculation engine" \
  --priority=90 \
  --dependencies="portfolio-analysis" \
  --input='{
    "requirements": {
      "algorithm_type": "threshold_based",
      "constraints": ["minimum_trade_amount", "tax_efficiency", "fund_restrictions"],
      "precision": "0.01_percent",
      "validation": "monte_carlo_testing"
    }
  }'

# 3. User Interface Tasks
claude-flow task create rebalancing-ui \
  "Create portfolio rebalancing user interface" \
  --priority=70 \
  --dependencies="portfolio-analysis" \
  --input='{
    "requirements": {
      "components": ["allocation_display", "rebalancing_preview", "confirmation_flow"],
      "framework": "React",
      "accessibility": "WCAG_2.1_AA",
      "mobile_responsive": true
    }
  }'

# 4. Notification System
claude-flow task create notification-system \
  "Implement rebalancing notification and alerts" \
  --priority=60 \
  --dependencies="rebalancing-algorithm" \
  --input='{
    "requirements": {
      "channels": ["email", "in_app", "sms"],
      "triggers": ["rebalancing_needed", "rebalancing_completed", "error_occurred"],
      "templates": "responsive_html"
    }
  }'

# 5. Compliance Validation
claude-flow task create compliance-validation \
  "Validate feature compliance with financial regulations" \
  --priority=95 \
  --dependencies="rebalancing-algorithm,notification-system" \
  --input='{
    "requirements": {
      "regulations": ["ERISA", "DOL_fiduciary", "SEC_rules"],
      "documentation": ["audit_trail", "calculation_methodology"],
      "testing": ["compliance_scenarios", "edge_cases"]
    }
  }'
```

## Implementation Workflow

### Step 7: Monitor Task Execution

```bash
# Start monitoring the workflow
claude-flow monitor --filter="project:retirement-platform"

# Check task status
claude-flow task list --status=running

# View agent workload
claude-flow agent list --show-tasks
```

### Step 8: Portfolio Analysis Implementation

The **portfolio-analyzer** agent will:

1. **Analyze Data Sources**:
   ```bash
   # Agent will create subtasks automatically
   claude-flow task list --agent=portfolio-analyzer
   ```

2. **Generate Analysis Reports**:
   - Current allocation calculations
   - Target deviation analysis
   - Rebalancing recommendations

3. **Store Results in Memory**:
   ```bash
   # Check stored analysis results
   claude-flow memory list --agent=portfolio-analyzer --type=artifact
   ```

### Step 9: Algorithm Development

The **rebalancing-algorithm** agent will:

1. **Implement Core Algorithm**:
   - Threshold-based rebalancing logic
   - Tax-efficient trading strategies
   - Constraint handling

2. **Create Validation Framework**:
   - Unit tests for calculations
   - Integration tests with portfolio data
   - Performance benchmarks

3. **Document Implementation**:
   ```bash
   # View algorithm documentation
   claude-flow memory retrieve --agent=rebalancing-algorithm --key=algorithm_spec
   ```

### Step 10: User Interface Development

The **ui-developer** agent will:

1. **Create React Components**:
   - Portfolio visualization
   - Rebalancing preview
   - Confirmation workflows

2. **Implement Responsive Design**:
   - Mobile-first approach
   - Accessibility compliance
   - Cross-browser testing

3. **Integration with Backend**:
   - API integration
   - Error handling
   - Loading states

## Testing & Validation

### Step 11: Comprehensive Testing

```bash
# Create testing tasks
claude-flow task create integration-testing \
  "Perform end-to-end testing of rebalancing feature" \
  --priority=85 \
  --assign=qa-validator \
  --input='{
    "test_scenarios": [
      "happy_path_rebalancing",
      "edge_cases",
      "error_conditions",
      "compliance_scenarios"
    ]
  }'

# Performance testing
claude-flow task create performance-testing \
  "Validate performance under load" \
  --priority=75 \
  --assign=qa-validator \
  --input='{
    "load_tests": {
      "concurrent_users": 1000,
      "portfolio_sizes": ["small", "medium", "large"],
      "response_time_sla": "< 2 seconds"
    }
  }'
```

### Step 12: Compliance Review

```bash
# Compliance validation
claude-flow task create final-compliance-review \
  "Conduct final compliance review" \
  --priority=95 \
  --assign=compliance-checker \
  --dependencies="integration-testing,performance-testing" \
  --input='{
    "review_areas": [
      "fiduciary_responsibility",
      "disclosure_requirements", 
      "audit_trail_completeness",
      "error_handling_compliance"
    ]
  }'
```

## Deployment

### Step 13: Deployment Preparation

```bash
# Create deployment tasks
claude-flow task create deployment-prep \
  "Prepare feature for production deployment" \
  --priority=80 \
  --input='{
    "deployment_requirements": {
      "environment": "production",
      "rollout_strategy": "feature_flag",
      "monitoring": "comprehensive",
      "rollback_plan": "automated"
    }
  }'
```

### Step 14: Production Rollout

```bash
# Monitor deployment
claude-flow workflow create production-rollout \
  --tasks="deployment-prep" \
  --approval-required=true \
  --notifications=enabled

# Execute deployment
claude-flow workflow execute production-rollout
```

## Monitoring & Maintenance

### Step 15: Post-Deployment Monitoring

```bash
# Set up monitoring tasks
claude-flow task create feature-monitoring \
  "Monitor rebalancing feature performance" \
  --priority=60 \
  --recurring=daily \
  --input='{
    "metrics": [
      "feature_usage",
      "calculation_accuracy", 
      "user_satisfaction",
      "error_rates",
      "compliance_metrics"
    ]
  }'
```

### Step 16: Feature Analysis

```bash
# Generate feature report
claude-flow memory query \
  --filter="project:retirement-platform AND feature:rebalancing" \
  --type=metrics \
  --format=report

# Export results
claude-flow memory export \
  --filter="project:retirement-platform" \
  --output=feature-development-report.json
```

## Advanced Features

### Multi-Agent Collaboration

```bash
# Create collaborative task requiring multiple agents
claude-flow task create cross-functional-review \
  "Collaborative review of rebalancing feature" \
  --priority=75 \
  --agents="portfolio-analyzer,rebalancing-algorithm,compliance-checker" \
  --collaboration-mode=consensus
```

### Workflow Automation

```bash
# Create automated workflow for feature updates
claude-flow workflow create feature-update-pipeline \
  --trigger="code_change" \
  --tasks="testing,compliance-check,deployment" \
  --auto-execute=true
```

### Memory and Learning

```bash
# Set up learning from feature development
claude-flow memory tag \
  --filter="project:retirement-platform" \
  --tags="lessons_learned,best_practices,optimization_opportunities"

# Create knowledge base for future features
claude-flow memory export \
  --filter="tags:lessons_learned" \
  --output=retirement-platform-knowledge-base.md \
  --format=markdown
```

## Troubleshooting

### Common Issues

1. **Agent Overload**:
   ```bash
   claude-flow agent list --show-load
   claude-flow agent spawn implementer --name=additional-helper
   ```

2. **Task Dependencies**:
   ```bash
   claude-flow task dependency-graph --visual
   claude-flow task update <task-id> --remove-dependency=<dep-id>
   ```

3. **Memory Management**:
   ```bash
   claude-flow memory cleanup --older-than=30d
   claude-flow memory optimize
   ```

## Best Practices Summary

1. **Agent Specialization**: Use specialized agents for different types of work
2. **Task Decomposition**: Break complex features into manageable tasks
3. **Dependency Management**: Define clear task dependencies
4. **Memory Utilization**: Leverage memory for knowledge sharing between agents
5. **Monitoring**: Continuously monitor progress and agent performance
6. **Compliance First**: Prioritize compliance and security tasks
7. **Testing Integration**: Include testing throughout the development process
8. **Documentation**: Maintain clear documentation in agent memory

## Conclusion

This guide demonstrates how Claude-Flow enables efficient, scalable feature development through:

- **Intelligent task orchestration**
- **Specialized agent collaboration** 
- **Comprehensive memory management**
- **Automated workflow execution**
- **Built-in monitoring and reporting**

The retirement planning feature serves as a template for building any complex product feature using Claude-Flow's multi-agent architecture.

---

**Next Steps**: 
- Customize agents for your specific domain
- Adapt task templates to your feature requirements  
- Integrate with your existing development tools
- Scale the approach for larger features and teams