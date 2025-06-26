# Scorecard MCP Server

Connect Claude to Scorecard's AI evaluation platform through natural language conversations.
Test, measure, and improve your AI systems without switching between tools.

## Quick Start

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "scorecard": {
      "command": "npx",
      "args": ["mcp-remote", "https://app.scorecard.ai/sse"]
    }
  }
}
```

You'll authenticate with your Scorecard account on first use via Clerk OAuth.

## What You Can Do

Ask Claude to help with AI evaluation tasks:

- "Create a new project for evaluating my chatbot"
- "Set up test cases for customer service scenarios"
- "Configure accuracy and helpfulness metrics"
- "Run an evaluation against my latest model"
- "Show me the performance results"

## Available Operations

- Projects: Create and manage evaluation projects
- Test Sets: Build comprehensive test suites
- Test Cases: Add and organize individual test scenarios
- Metrics: Configure custom evaluation criteria
- Systems: Manage AI system configurations and versions
- Runs: Execute evaluations and analyze results

## Technical Details

Built using the https://modelcontextprotocol.io/specification/2025-06-18/changelog on
Scorecard's Next.js frontend:
- Clerk OAuth for secure authentication
- JWT tokens passed to Scorecard's backend
- Auto-generated MCP tools from OpenAPI spec
- Deployed on Vercel's edge infrastructure

## Security

- OAuth 2.0 authentication through Clerk
- Access limited to your authenticated Scorecard account
- Tokens passed through but never stored

---
Transform Scorecard into a conversational AI evaluation assistant - comprehensive model
testing through natural conversation.