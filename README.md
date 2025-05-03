# Scorecard MCP Server

A Model Context Protocol (MCP) server for Scorecard, enabling Claude and other AI assistants to interact with Scorecard data through the MCP protocol.

## Features

- Implements the Scorecard MCP tools from the `scorecard-ai-mcp` package
- Deployed as a Cloudflare Worker
- Simple authentication via API key

## Setup

### Prerequisites

- Node.js and npm
- Scorecard API access
- Cloudflare account

### Installation

1. Clone this repository
   ```bash
   git clone https://github.com/yourusername/scorecard-mcp.git
   cd scorecard-mcp
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up environment variables and secrets
   ```bash
   # Add Scorecard API key
   npx wrangler secret put SCORECARD_API_KEY
   ```

4. Run locally
   ```bash
   npm run dev
   ```

5. Deploy to Cloudflare
   ```bash
   npm run deploy
   ```

## Usage

Once deployed, the MCP server can be used with Claude by adding it as an integration. The endpoint will be:

```
https://scorecard-mcp.your-worker-subdomain.workers.dev/mcp
```

## Development

To update the MCP server configuration, modify the settings in `src/index.js`.