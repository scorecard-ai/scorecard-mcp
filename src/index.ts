import { server, init } from 'scorecard-ai-mcp/server';
import Scorecard from 'scorecard-ai';
import { createServer } from '@modelcontextprotocol/sdk/server/index.js';

// Define environment interface for our Cloudflare Worker
export interface Env {
  // Add your environment variables/secrets here
  SCORECARD_API_KEY?: string;
}

// Create a simple router handler
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  // Health check endpoint
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({ status: 'healthy' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
  
  // Handle MCP requests
  if (url.pathname === '/mcp' && request.method === 'POST') {
    try {
      // Initialize the MCP server with token directly
      const TOKEN = "***REMOVED***.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiYXpwIjoiaHR0cHM6Ly9hcHAuZ2V0c2NvcmVjYXJkLmFpIiwiZW1haWwiOiJkYXJlQHNjb3JlY2FyZC5pbyIsImV4cCI6MjAwNTQ5NzEzMCwiaWF0IjoxNzQ2Mjk3MTMwLCJpc3MiOiJodHRwczovL2NsZXJrLmdldHNjb3JlY2FyZC5haSIsImp0aSI6IjJlY2FkYjc5NjQ0MzU5YmIxNjBlIiwibmJmIjoxNzQ2Mjk3MTI1LCJvcmdfaWQiOiJvcmdfMndiM0h3cDRJZ1lSUVZRUjB2RFB5VG9rbDZQIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiJ1c2VyXzJYSU12NVlXRjk5dk5lT1J0dUdXbTJRcDE3VyJ9.DGgo1pY2USQ5JrDlehjG-If7-l5OZC1a0TKqUPtQeIA";
      const scorecardClient = new Scorecard({
        bearerToken: TOKEN  // Use bearerToken instead of apiKey
      });
      
      // Create a standard MCP server that can handle HTTP requests
      const mcpServer = createServer({
        tools: [],  // The tools will come from the init function
      });
      
      // Initialize it with our scorecard client
      init({
        server: mcpServer,
        client: scorecardClient
      });
      
      // Process the request using the MCP server
      const response = await mcpServer.handle(request);
      
      // Add CORS headers
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      console.error('Error handling MCP request:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error', 
          message: error instanceof Error ? error.message : String(error) 
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }
  
  // 404 for all other routes
  return new Response('Not Found', { status: 404 });
}

// Export the Cloudflare Worker handler
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return handleRequest(request, env);
  }
};