// Custom implementation of a simplified tools adapter
// This is a minimal implementation that doesn't require external dependencies

// Import configuration
import { toolsSchema, mockProjects, mockRecords } from './config';

export interface Env {
  // Add environment variables
  SCORECARD_API_KEY?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_OAUTH_CLIENT_ID?: string;
  CLERK_OAUTH_CLIENT_SECRET?: string;
}

// Create a handler for the tools adapter
export async function handleStainlessTools(request: Request, env: Env): Promise<Response> {
  // Check for preflight OPTIONS request
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
  
  // Only handle POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  try {
    // Parse the request
    const requestBody = await request.json();
    console.log('Received tools request:', JSON.stringify(requestBody));
    
    // Extract the tool name and parameters
    const { tool, params } = requestBody;
    
    // Validate the tool exists
    if (!tool || !toolsSchema[tool]) {
      return new Response(JSON.stringify({ 
        error: 'Invalid tool',
        message: `Tool '${tool}' not found`
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Handle different tools
    let result;
    
    if (tool === 'get_projects') {
      // Here we would connect to the Scorecard API
      // For now, return mock data
      result = {
        projects: mockProjects
      };
    } else if (tool === 'get_records') {
      const projectId = params?.project_id || 'default';
      
      // Here we would connect to the Scorecard API
      // For now, return mock data
      result = {
        records: mockRecords
      };
    } else {
      return new Response(JSON.stringify({ 
        error: 'Not implemented',
        message: `Tool '${tool}' is not implemented yet`
      }), {
        status: 501,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Return the result
    return new Response(JSON.stringify({ 
      result,
      success: true
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error in tools endpoint:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}