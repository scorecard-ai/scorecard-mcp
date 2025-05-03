import { createServer } from 'scorecard-ai-mcp/server';

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
      // Create the MCP server with the generated tools
      const mcpServer = createServer({
        // Add configuration options as needed
        apiKey: env.SCORECARD_API_KEY,
      });
      
      // Process the request
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