// Define the Scorecard MCP tools schema
export const toolsSchema = {
  get_projects: {
    description: 'Get all projects from Scorecard',
    parameters: {},
  },
  get_records: {
    description: 'Get records from a Scorecard project',
    parameters: {
      project_id: {
        type: 'string',
        description: 'The ID of the project to get records from'
      }
    }
  }
};

// Mock project data
export const mockProjects = [
  { id: 'proj_1', name: 'Test Suite', description: 'A test project' },
  { id: 'proj_2', name: 'Production Monitoring', description: 'Monitor production metrics' },
  { id: 'proj_3', name: 'Customer Feedback', description: 'Track customer feedback' }
];

// Mock record data
export const mockRecords = [
  { id: 'rec_1', name: 'Record 1', status: 'active' },
  { id: 'rec_2', name: 'Record 2', status: 'complete' },
  { id: 'rec_3', name: 'Record 3', status: 'pending' }
];

// Server configuration
export const serverConfig = {
  // MCP endpoints supported by this server
  endpoints: {
    mcp: '/mcp',       // Standard MCP endpoint
    sse: '/sse',       // Alternative SSE endpoint
    stainless: '/stainless'  // Stainless Tools endpoint
  },
  
  // OAuth configuration
  oauth: {
    issuer: 'https://clerk.getscorecard.ai',
    clientId: 'arIFvS0RRW3eK3gH',
    redirectUri: 'https://claude.ai/oauth/callback'
  }
};