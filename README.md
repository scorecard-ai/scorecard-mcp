# Scorecard remote MCP server

Connect Claude to Scorecard's AI evaluation platform through natural language conversations.
Test, measure, and improve your AI systems without switching between tools.

## Installation

Add the Scorecard MCP server's remote URL `https://mcp.scorecard.io/mcp` to your MCP client, e.g. Claude or Cursor.

See the [full setup instructions](https://docs.scorecard.io/features/mcp) for more info and local installation configuration.

## Technical Architecture

This remote MCP server implements the latest version of the [Model Context Protocol server specification](https://modelcontextprotocol.io/docs/learn/server-concepts). It is built with:

- **[Clerk](https://clerk.com)** for authentication, implementing the [OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc8414) specification for secure, standards-compliant authentication flows.
- **[Stainless](https://stainless.com/)** for auto-generated, type-safe MCP endpoints that stay in sync with the API specification.
- **[Sentry](https://sentry.io)** for production-grade monitoring, error tracking, and performance insights.

## What You Can Do

Ask Claude to help with AI evaluation tasks:

- "Create a new project for evaluating my chatbot"
- "Set up test cases for customer service scenarios"
- "Configure accuracy and helpfulness metrics"
- "Run an evaluation against my latest model"
- "Show me the performance results"
