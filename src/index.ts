import { server, init } from 'scorecard-ai-mcp/server';
import Scorecard from 'scorecard-ai';

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
  
  // OAuth Well-Known Endpoint for discovery
  if (url.pathname === '/.well-known/oauth-authorization-server') {
    return new Response(JSON.stringify({
      issuer: "https://scorecard-mcp.dare-d5b.workers.dev",
      authorization_endpoint: "https://scorecard-mcp.dare-d5b.workers.dev/oauth/authorize",
      token_endpoint: "https://scorecard-mcp.dare-d5b.workers.dev/oauth/token",
      scopes_supported: ["scorecard.api"],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"]
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  // OAuth Authorization Endpoint
  if (url.pathname === '/oauth/authorize') {
    // In a real implementation, this would redirect to a login page
    // For our simple implementation, we'll just return a dummy code
    
    // Log all request details for debugging
    console.log("Authorization request received:", {
      url: request.url,
      headers: Object.fromEntries([...request.headers.entries()]),
      params: Object.fromEntries([...url.searchParams.entries()])
    });
    
    // Get the redirect_uri from the query parameters
    const redirectUri = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state');
    const codeChallenge = url.searchParams.get('code_challenge');
    const clientId = url.searchParams.get('client_id');
    const responseType = url.searchParams.get('response_type');
    
    console.log("OAuth params:", { redirectUri, state, codeChallenge, clientId, responseType });
    
    if (!redirectUri) {
      console.log("Error: Missing redirect_uri parameter");
      return new Response('Missing redirect_uri parameter', { status: 400 });
    }
    
    // Generate a random code
    const code = 'dummy_auth_code_' + Math.random().toString(36).substring(2, 15);
    
    // Redirect to the callback URL with the code
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.append('code', code);
    
    // Add state if provided
    if (state) {
      callbackUrl.searchParams.append('state', state);
    }
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': callbackUrl.toString(),
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  // OAuth Token Endpoint
  if (url.pathname === '/oauth/token' && request.method === 'POST') {
    try {
      // Log token request details
      console.log("Token request received:", {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries([...request.headers.entries()])
      });
      
      // Parse the request body
      const contentType = request.headers.get('content-type') || '';
      let requestBody;
      
      if (contentType.includes('application/json')) {
        requestBody = await request.json();
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        requestBody = Object.fromEntries(formData);
      } else {
        // Try to read as text
        requestBody = await request.text();
      }
      
      console.log("Token request body:", requestBody);
      
      // We'll just return a dummy token without validating anything
      const dummyToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkdW1teV91c2VyIiwiaWF0IjoxNTE2MjM5MDIyfQ.KobkNJNvj7jQWl3eri54FfRh1TvEQrqNlCaeXLMlqpE';
      
      return new Response(JSON.stringify({
        access_token: dummyToken,
        token_type: 'Bearer',
        expires_in: 3600
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'invalid_request' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
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
  if (url.pathname === '/mcp') {
    console.log("MCP request received:", {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries([...request.headers.entries()])
    });
    
    // Handle GET requests for streaming connections
    if (request.method === 'GET') {
      // Check if this is a server-sent events request
      const acceptHeader = request.headers.get('accept');
      console.log("MCP GET request with Accept header:", acceptHeader);
      
      if (acceptHeader && acceptHeader.includes('text/event-stream')) {
        // This is an SSE connection request
        const responseStream = new ReadableStream({
          start(controller) {
            // Send an initial message
            const initialMessage = `event: ready\ndata: {"status":"connected"}\n\n`;
            controller.enqueue(new TextEncoder().encode(initialMessage));
            
            // Keep the connection alive
            const interval = setInterval(() => {
              controller.enqueue(new TextEncoder().encode(': ping\n\n'));
            }, 30000);
            
            // Clean up when the connection closes
            const cleanup = () => {
              clearInterval(interval);
            };
            
            // Return a cleanup function
            return cleanup;
          }
        });
        
        return new Response(responseStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // Regular GET request (not SSE)
      return new Response(JSON.stringify({
        version: "v1",
        status: "ready",
        message: "MCP server is ready. Use POST for MCP requests."
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Continue with POST handling
    if (request.method === 'POST') {
    try {
      // Initialize the MCP server with token directly
      const TOKEN = "***REMOVED***.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiYXpwIjoiaHR0cHM6Ly9hcHAuZ2V0c2NvcmVjYXJkLmFpIiwiZW1haWwiOiJkYXJlQHNjb3JlY2FyZC5pbyIsImV4cCI6MjAwNTQ5NzEzMCwiaWF0IjoxNzQ2Mjk3MTMwLCJpc3MiOiJodHRwczovL2NsZXJrLmdldHNjb3JlY2FyZC5haSIsImp0aSI6IjJlY2FkYjc5NjQ0MzU5YmIxNjBlIiwibmJmIjoxNzQ2Mjk3MTI1LCJvcmdfaWQiOiJvcmdfMndiM0h3cDRJZ1lSUVZRUjB2RFB5VG9rbDZQIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiJ1c2VyXzJYSU12NVlXRjk5dk5lT1J0dUdXbTJRcDE3VyJ9.DGgo1pY2USQ5JrDlehjG-If7-l5OZC1a0TKqUPtQeIA";
      const scorecardClient = new Scorecard({
        bearerToken: TOKEN  // Use bearerToken instead of apiKey
      });
      
      // Initialize the MCP server with our client
      init({
        server: server,
        client: scorecardClient
      });
      
      // Since we can't directly handle HTTP with the server object,
      // we'll parse the request and manually construct our response
      const requestBody = await request.json();
      console.log("Received MCP request:", JSON.stringify(requestBody));
      
      // Check if this is an authentication request
      if (requestBody?.type === "auth_request") {
        console.log("MCP Authentication request received:", requestBody);
        
        // Handle MCP authentication request
        const responseBody = {
          version: "v1",
          type: "auth_response",
          auth_response: {
            type: "none" // No authentication required
          }
        };
        
        console.log("Sending auth response:", responseBody);
        
        // Return authentication response
        return new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // Check if this is an introspection request
      if (requestBody?.request?.type === "introspect") {
        // Return a list of available tools
        const responseBody = {
          version: "v1",
          type: "response",
          response: {
            type: "success",
            success: {
              tools: [
                {
                  name: "get_projects",
                  description: "Get all projects from Scorecard",
                  input_schema: {},
                  authentication: {
                    type: "none"
                  }
                },
                {
                  name: "get_records",
                  description: "Get records from Scorecard",
                  input_schema: {
                    type: "object",
                    properties: {
                      project_id: {
                        type: "string",
                        description: "The ID of the project"
                      }
                    }
                  },
                  authentication: {
                    type: "none"
                  }
                }
              ]
            }
          }
        };
        
        // Return introspection response
        return new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // For tool invocation requests
      const toolName = requestBody?.request?.invoke?.tool;
      const toolParams = requestBody?.request?.invoke?.parameters || {};
      
      console.log("Tool:", toolName, "Parameters:", JSON.stringify(toolParams));
      
      // Hard-coded sample response for testing
      const responseBody = {
        version: "v1",
        type: "response",
        response: {
          type: "success",
          success: {
            content: [
              {
                type: "text",
                text: "Successfully connected to Scorecard MCP server"
              }
            ]
          }
        }
      };
      
      // Return a proper MCP response
      const response = new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
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
    } // End of POST block
  } // End of /mcp block
  
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