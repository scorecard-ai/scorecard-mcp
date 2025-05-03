# Scorecard MCP Server

A Model Context Protocol (MCP) server for Scorecard, enabling Claude and other AI assistants to interact with Scorecard data through the MCP protocol.

## Features

- Implements the Scorecard MCP tools from the `scorecard-ai-mcp` package
- Deployed as a Cloudflare Worker
- Simple authentication via API key
- TypeScript support for better type safety
- CORS support for cross-origin requests

## Setup

### Prerequisites

- Node.js and npm
- Scorecard API access
- Cloudflare account
- Clerk account (for OAuth authentication)

### Setting up Clerk OAuth (Optional)

1. Create a Clerk account at https://clerk.dev
2. In your Clerk Dashboard, navigate to "OAuth Applications"
3. Create a new OAuth Application
4. Set the redirect URI to the callback URL of your client application
5. Copy the Client ID and Client Secret for use in the next steps

### Installation

1. Clone this repository
   ```bash
   git clone https://github.com/scorecard-ai/scorecard-mcp.git
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
   
   # For Clerk OAuth (if used)
   npx wrangler secret put CLERK_SECRET_KEY
   npx wrangler secret put CLERK_PUBLISHABLE_KEY
   npx wrangler secret put CLERK_OAUTH_CLIENT_ID
   npx wrangler secret put CLERK_OAUTH_CLIENT_SECRET
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

Once deployed, the MCP server can be used with Claude by adding it as an integration. The endpoint is:

```
https://scorecard-mcp.dare-d5b.workers.dev/mcp
```

## Development

To update the MCP server configuration, modify the settings in `src/index.ts`.