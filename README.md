# Scorecard MCP Server on Cloudflare

This repository allows you to deploy a remote MCP server on Cloudflare Workers that enables Claude and other MCP clients to access Scorecard's evaluation tools.

## Get started: 

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/scorecard-ai/scorecard-mcp)

This will deploy your Scorecard MCP server to a URL like: `scorecard-mcp.<your-account>.workers.dev/sse`

Alternatively, you can clone this repository and deploy it using Wrangler:
```bash
git clone https://github.com/scorecard-ai/scorecard-mcp.git
cd scorecard-mcp
npm install
npm run deploy
```

## About This MCP Server

This MCP server provides access to Scorecard's evaluation tools directly from Claude and other MCP-compatible clients. It uses Clerk for authentication and is built on Cloudflare Workers for reliable, global deployment.

The server implements the MCP specification (2025-03-26) and provides secure access to Scorecard's API for running experiments, generating synthetic data, configuring metrics, and analyzing model performance.

## Connect to MCP Clients

This MCP server works with various MCP-compatible clients:

### Connect to claude.ai, Cursor, and Windsurf

Once deployed, you can connect to your MCP server from Claude and other MCP-compatible clients by providing your server URL:

```
https://scorecard-mcp.<your-account>.workers.dev/sse
```

### Connect via Cloudflare AI Playground

You can also connect through the Cloudflare AI Playground:

1. Go to https://playground.ai.cloudflare.com/
2. Enter your deployed MCP server URL (`scorecard-mcp.<your-account>.workers.dev/sse`)
3. You can now use Scorecard's evaluation tools directly from the playground!

### Connect via Claude Desktop

For local testing, you can connect to your MCP server from Claude Desktop by using the [mcp-remote proxy](https://www.npmjs.com/package/mcp-remote).

Follow [Anthropic's Quickstart](https://modelcontextprotocol.io/quickstart/user) and within Claude Desktop go to Settings > Developer > Edit Config.

Update with this configuration:

```json
{
  "mcpServers": {
    "scorecard": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://scorecard-mcp.<your-account>.workers.dev/sse"  // or http://localhost:8787/sse for local testing
      ]
    }
  }
}
```

Restart Claude and you should see the tools become available. 

## Local Development

For local development, create a ".dev.vars" file with your Clerk credentials:
```bash
cp .dev.vars.example .dev.vars
```

Configure the following variables in your .dev.vars file:

| Variable | Source | Notes |
|----------|--------|-------|
| CLERK_CLIENT_ID | Clerk Dashboard -> Configure -> OAuth Applications | |
| CLERK_CLIENT_SECRET | Clerk Dashboard -> Configure -> OAuth Applications | Cannot be viewed after initial generation |
| CLERK_DOMAIN | Clerk Dashboard -> Configure -> API Keys -> Frontend API URL | Override this with the Clerk development URL if using with local Scorecard server |
| CLERK_PUBLISHABLE_KEY | Clerk Dashboard -> Configure -> API Keys -> Publishable Key | Override this with the pk_test_* one if using with local Scorecard server |

Then run the development server:
```bash
npm install
npm run dev
```

Remember to run `npx wrangler types` to generate types for the environment variables.

## Contributors

Special thanks to Dustin Moore for his engineering leadership in developing this MCP implementation.
