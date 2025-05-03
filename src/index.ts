import { server, init } from 'scorecard-ai-mcp/server';
import Scorecard from 'scorecard-ai';

import { createClerkClient } from '@clerk/backend';

// Define environment interface for our Cloudflare Worker
export interface Env {
  // Add your environment variables/secrets here
  SCORECARD_API_KEY?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_OAUTH_CLIENT_ID?: string;
  CLERK_OAUTH_CLIENT_SECRET?: string;
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
    // Get your Clerk instance URL from env vars, fallback to a default
    const clerkIssuer = `https://${env.CLERK_PUBLISHABLE_KEY?.split('_')[1] || 'clerk.example.com'}`;
    
    console.log("OAuth discovery requested, using Clerk issuer:", clerkIssuer);
    
    return new Response(JSON.stringify({
      issuer: clerkIssuer,
      authorization_endpoint: `${clerkIssuer}/oauth/authorize`,
      token_endpoint: `${clerkIssuer}/oauth/token`,
      jwks_uri: `${clerkIssuer}/.well-known/jwks.json`,
      scopes_supported: ["openid", "profile", "email", "scorecard.api"],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["client_secret_post"],
      code_challenge_methods_supported: ["S256"]
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  // OAuth Authorization Endpoint - redirect to Clerk
  if (url.pathname === '/oauth/authorize') {
    // Log all request details for debugging
    console.log("Authorization request received, redirecting to Clerk:", {
      url: request.url,
      params: Object.fromEntries([...url.searchParams.entries()])
    });
    
    // Get the parameters from the query
    const redirectUri = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state');
    const codeChallenge = url.searchParams.get('code_challenge');
    const codeChallengeMethod = url.searchParams.get('code_challenge_method');
    const responseType = url.searchParams.get('response_type');
    const scope = url.searchParams.get('scope');
    
    if (!redirectUri) {
      console.log("Error: Missing redirect_uri parameter");
      return new Response('Missing redirect_uri parameter', { status: 400 });
    }
    
    if (!env.CLERK_PUBLISHABLE_KEY) {
      console.log("Error: Missing CLERK_PUBLISHABLE_KEY");
      return new Response('Server misconfiguration: Missing OAuth credentials', { status: 500 });
    }
    
    // Get the Clerk instance URL from the publishable key
    const clerkInstance = `https://${env.CLERK_PUBLISHABLE_KEY.split('_')[1]}`;
    
    // Build the authorization URL for Clerk
    const clerkAuthUrl = new URL(`${clerkInstance}/oauth/authorize`);
    
    // Add all the required parameters
    clerkAuthUrl.searchParams.append('client_id', env.CLERK_OAUTH_CLIENT_ID || '');
    clerkAuthUrl.searchParams.append('redirect_uri', redirectUri);
    clerkAuthUrl.searchParams.append('response_type', responseType || 'code');
    
    if (state) {
      clerkAuthUrl.searchParams.append('state', state);
    }
    
    if (scope) {
      clerkAuthUrl.searchParams.append('scope', scope);
    }
    
    if (codeChallenge && codeChallengeMethod) {
      clerkAuthUrl.searchParams.append('code_challenge', codeChallenge);
      clerkAuthUrl.searchParams.append('code_challenge_method', codeChallengeMethod);
    }
    
    console.log("Redirecting to Clerk:", clerkAuthUrl.toString());
    
    // Redirect to Clerk's OAuth authorization endpoint
    return new Response(null, {
      status: 302,
      headers: {
        'Location': clerkAuthUrl.toString(),
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  // OAuth Token Endpoint - proxy to Clerk
  if (url.pathname === '/oauth/token' && request.method === 'POST') {
    try {
      console.log("Token request received, proxying to Clerk");
      
      if (!env.CLERK_PUBLISHABLE_KEY || !env.CLERK_OAUTH_CLIENT_ID || !env.CLERK_OAUTH_CLIENT_SECRET) {
        console.error("Missing Clerk credentials");
        return new Response(JSON.stringify({ 
          error: 'server_error',
          error_description: 'OAuth server configuration error'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // Get the Clerk instance URL from the publishable key
      const clerkInstance = `https://${env.CLERK_PUBLISHABLE_KEY.split('_')[1]}`;
      const tokenUrl = `${clerkInstance}/oauth/token`;
      
      console.log("Forwarding token request to:", tokenUrl);
      
      // Forward the request to Clerk as-is
      const clerkResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': request.headers.get('content-type') || 'application/x-www-form-urlencoded',
        },
        body: await request.text()
      });
      
      // Return the response from Clerk
      const tokenData = await clerkResponse.json();
      console.log("Token response status:", clerkResponse.status);
      
      return new Response(JSON.stringify(tokenData), {
        status: clerkResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error("Error in token endpoint:", error);
      return new Response(JSON.stringify({ 
        error: 'server_error',
        error_description: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
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
    // Log basic info to avoid cluttering logs
    console.log("MCP request received:", {
      method: request.method,
      url: request.url
    });
    
    // Initialize Clerk client for token validation
    let clerkClient;
    try {
      if (env.CLERK_SECRET_KEY) {
        clerkClient = createClerkClient({ 
          secretKey: env.CLERK_SECRET_KEY 
        });
        console.log("Clerk client initialized");
      } else {
        console.log("No CLERK_SECRET_KEY provided, skipping token validation");
      }
    } catch (error) {
      console.error("Error initializing Clerk client:", error);
    }
    
    // Handle GET requests for streaming connections
    if (request.method === 'GET') {
      // Check if this is a server-sent events request
      const acceptHeader = request.headers.get('accept');
      console.log("MCP GET request with Accept header:", acceptHeader);
      
      if (acceptHeader && acceptHeader.includes('text/event-stream')) {
        console.log("Setting up SSE connection for MCP");
        
        // Instead of using a streaming response which might timeout in Cloudflare,
        // let's use a simpler approach for testing
        const headers = new Headers({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
        
        // Construct a simple SSE response that won't timeout
        let responseBody = 
          // Initial ready message with event type
          `event: ready\ndata: {"version":"v1","type":"connection_status","connection_status":{"status":"connected"}}\n\n` +
          // Add authentication message with event type, including OAuth option
          `event: authentication\ndata: {"version":"v1","type":"auth_response","auth_response":{"type":"oauth","status":"success","oauth":{"server":"https://scorecard-mcp.dare-d5b.workers.dev"}}}\n\n` +
          // Add tools message with event type
          `event: tools\ndata: {"version":"v1","type":"tools","tools":[{"name":"get_projects","description":"Get all projects from Scorecard"},{"name":"get_records","description":"Get records from Scorecard"}]}\n\n` +
          // Ping to keep the connection alive
          `: ping\n\n`;
          
        return new Response(responseBody, { 
          headers: headers
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
      console.log("Handling MCP POST request");
      // We don't need to initialize clients for our simplified implementation
      
      // We don't need to initialize MCP server for our simplified implementation
      
      // Since we can't directly handle HTTP with the server object,
      // we'll parse the request and manually construct our response
      const requestBody = await request.json();
      console.log("Received MCP request:", JSON.stringify(requestBody));
      
      // Check if this is an authentication request
      if (requestBody?.type === "auth_request") {
        console.log("MCP Authentication request received:", requestBody);
        
        // Extract any credentials if provided
        const credentials = requestBody.credentials;
        console.log("Auth request credentials:", credentials);
        
        // Check if we have a bearer token in the credentials
        if (credentials?.type === "bearer" && credentials?.token && clerkClient) {
          try {
            // Validate the token with Clerk
            console.log("Attempting to validate bearer token with Clerk");
            
            // Using the Clerk authenticate request to validate the OAuth token
            const authRequest = await clerkClient.authenticateRequest(request, { 
              acceptsToken: 'oauth_access_token'
            });
            
            // Check if token is valid
            const auth = authRequest.toAuth();
            if (auth.tokenType === 'oauth_access_token' && auth.sub) {
              console.log("Token validation successful, user:", auth.sub);
              
              // Return a success response
              const responseBody = {
                version: "v1",
                type: "auth_response",
                auth_response: {
                  type: "oauth",
                  status: "success"
                }
              };
              
              return new Response(JSON.stringify(responseBody), {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*'
                }
              });
            }
          } catch (error) {
            console.error("Token validation error:", error);
            
            // Return an authentication failure
            return new Response(JSON.stringify({
              version: "v1",
              type: "auth_response",
              auth_response: {
                type: "oauth",
                status: "error",
                error: {
                  type: "invalid_token",
                  message: "Invalid or expired token"
                }
              }
            }), {
              status: 401,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            });
          }
        }
        
        // For our simple implementation, we'll also accept requests without credentials
        // In a real implementation, you would require proper authentication
        
        // Handle MCP authentication request
        const responseBody = {
          version: "v1",
          type: "auth_response",
          auth_response: {
            type: "none", // No authentication required
            status: "success"
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
      
      // Check if this is an invocation request
      if (requestBody?.request?.type === "invoke") {
        console.log("Tool invocation request:", requestBody.request.invoke);
        
        const toolName = requestBody.request.invoke.tool;
        const params = requestBody.request.invoke.parameters || {};
        
        // Handle different tools
        let responseContent = [];
        
        if (toolName === "get_projects") {
          // Simulate projects data
          responseContent = [
            {
              type: "text",
              text: "Here are your projects: \n\n- Project 1: Test Suite\n- Project 2: Production Monitoring\n- Project 3: Customer Feedback"
            }
          ];
        } else if (toolName === "get_records") {
          // Simulate records data
          responseContent = [
            {
              type: "text",
              text: `Records for project ${params.project_id || 'default'}: \n\n- Record 1: Test case passed\n- Record 2: Response time within limits\n- Record 3: User satisfaction high`
            }
          ];
        } else {
          // Unknown tool
          return new Response(JSON.stringify({
            version: "v1",
            type: "response",
            response: {
              type: "error",
              error: {
                type: "invalid_request",
                message: `Unknown tool: ${toolName}`
              }
            }
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        // Return successful response
        return new Response(JSON.stringify({
          version: "v1",
          type: "response",
          response: {
            type: "success",
            success: {
              content: responseContent
            }
          }
        }), {
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