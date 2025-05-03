# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev`: Run development server locally with Wrangler
- `npm run build`: Build the application
- `npm run deploy`: Deploy to Cloudflare Workers
- `npx tsc --noEmit`: Type check without emitting files

## Code Style

- **TypeScript**: Use strict typing with interfaces for all data structures
- **Formatting**: 2-space indentation, no trailing whitespace
- **Naming**:
  - Interfaces: PascalCase with descriptive names (e.g., `Env`)
  - Functions: camelCase with verb prefixes (e.g., `handleRequest`)
  - Variables: camelCase, descriptive names
- **Imports**: Group imports by source (built-in, external, internal)
- **Error Handling**: Use try/catch with specific error handling, type check errors
- **API Responses**: Always include CORS headers and proper content-type
- **Comments**: Use JSDoc style for functions and interfaces

When modifying MCP tools, reference the scorecard-ai-mcp package documentation.