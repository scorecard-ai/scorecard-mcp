import { server, init } from 'scorecard-ai-mcp/server';
import Scorecard from 'scorecard-ai';
import { createClerkClient } from '@clerk/backend';
import { handleStainlessTools } from './stainless-tools';
import { serverConfig, toolsSchema } from './config';

// Define environment interface for our Cloudflare Worker
export interface Env {
  // Add your environment variables/secrets here
  SCORECARD_API_KEY?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_OAUTH_CLIENT_ID?: string;
  CLERK_OAUTH_CLIENT_SECRET?: string;
}

// Helper to log with timestamps and additional context
function logWithContext(level: string, message: string, context?: any) {
  const timestamp = new Date().toISOString();
  if (context) {
    console[level](`[${timestamp}] [scorecard-mcp] ${message}`, context);
  } else {
    console[level](`[${timestamp}] [scorecard-mcp] ${message}`);
  }
}

// Create a simple router handler
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
  
  logWithContext('debug', `Request received: ${request.method} ${url.pathname}`);
  
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
  
  // Debug endpoint to show server configuration
  if (url.pathname === '/debug') {
    const baseUrl = `https://${request.headers.get('host') || "scorecard-mcp.dare-d5b.workers.dev"}`;
    
    // Create links to test each endpoint
    const endpoints = Object.entries(serverConfig.endpoints).map(([name, path]) => ({
      name,
      path,
      url: `${baseUrl}${path}`,
      testUrl: `${baseUrl}${path}`
    }));
    
    // Include links to test discovery
    const discoveryUrl = `${baseUrl}/.well-known/oauth-authorization-server`;
    
    // Create a debug response object
    const debugInfo = {
      server: {
        baseUrl,
        endpoints,
        discoveryUrl
      },
      oauth: {
        ...serverConfig.oauth,
        fullAuthorizationUrl: `${baseUrl}/oauth/authorize?client_id=${serverConfig.oauth.clientId}&redirect_uri=${encodeURIComponent(serverConfig.oauth.redirectUri)}&response_type=code&scope=profile%20email%20scorecard.api`
      },
      tools: Object.keys(toolsSchema).map(name => ({ 
        name, 
        description: toolsSchema[name].description,
        testUrl: `${baseUrl}/mcp`,
        testPayload: JSON.stringify({
          version: "v1",
          request: {
            type: "invoke",
            invoke: {
              tool: name
            }
          }
        })
      }))
    };
    
    // Return a formatted HTML page
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scorecard MCP Debug</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 {
      margin-top: 2rem;
    }
    pre {
      background: #f5f5f5;
      padding: 1rem;
      border-radius: 4px;
      overflow: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    th, td {
      padding: 0.5rem;
      text-align: left;
      border: 1px solid #ddd;
    }
    th {
      background: #f5f5f5;
    }
    .btn {
      display: inline-block;
      padding: 0.5rem 1rem;
      background: #4a6cf7;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin-right: 0.5rem;
    }
    .card {
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 1rem;
      margin: 1rem 0;
    }
  </style>
</head>
<body>
  <h1>Scorecard MCP Server Debug</h1>
  
  <div class="card">
    <h2>Server Information</h2>
    <p>Base URL: <code>${baseUrl}</code></p>
    
    <h3>Endpoints</h3>
    <table>
      <tr>
        <th>Name</th>
        <th>Path</th>
        <th>Full URL</th>
        <th>Test</th>
      </tr>
      ${endpoints.map(endpoint => `
      <tr>
        <td>${endpoint.name}</td>
        <td><code>${endpoint.path}</code></td>
        <td><code>${endpoint.url}</code></td>
        <td>
          <a href="${endpoint.testUrl}" target="_blank" class="btn">Test GET</a>
          ${endpoint.name === 'mcp' || endpoint.name === 'sse' ? 
            `<button onclick="testSSE('${endpoint.testUrl}')" class="btn">Test SSE</button>` : ''}
        </td>
      </tr>
      `).join('')}
    </table>
  </div>
  
  <div class="card">
    <h2>OAuth Configuration</h2>
    <p>Issuer: <code>${serverConfig.oauth.issuer}</code></p>
    <p>Client ID: <code>${serverConfig.oauth.clientId}</code></p>
    <p>Redirect URI: <code>${serverConfig.oauth.redirectUri}</code></p>
    
    <h3>Discovery</h3>
    <p>
      <a href="${discoveryUrl}" target="_blank" class="btn">Test Discovery</a>
    </p>
    
    <h3>Authorization</h3>
    <p>
      <a href="${serverConfig.oauth.fullAuthorizationUrl}" target="_blank" class="btn">Test OAuth Flow</a>
    </p>
  </div>
  
  <div class="card">
    <h2>Available Tools</h2>
    <table>
      <tr>
        <th>Name</th>
        <th>Description</th>
        <th>Test</th>
      </tr>
      ${debugInfo.tools.map(tool => `
      <tr>
        <td>${tool.name}</td>
        <td>${tool.description}</td>
        <td>
          <button onclick="testTool('${tool.testUrl}', '${tool.name}')" class="btn">Test Tool</button>
        </td>
      </tr>
      `).join('')}
    </table>
  </div>
  
  <div class="card">
    <h2>Test Results</h2>
    <div id="results">
      <p>Run tests to see results here.</p>
    </div>
  </div>
  
  <script>
    // Function to test SSE connection
    function testSSE(url) {
      const resultsDiv = document.getElementById('results');
      resultsDiv.innerHTML = '<h3>Testing SSE Connection</h3><p>Connecting to ' + url + '...</p>';
      
      try {
        const evtSource = new EventSource(url);
        let eventsReceived = 0;
        
        evtSource.onopen = function() {
          resultsDiv.innerHTML += '<p class="success">Connection opened successfully</p>';
        };
        
        evtSource.onerror = function(err) {
          resultsDiv.innerHTML += '<p class="error">Error: ' + JSON.stringify(err) + '</p>';
          evtSource.close();
        };
        
        // Listen for different event types
        ['ready', 'authentication', 'tools'].forEach(eventType => {
          evtSource.addEventListener(eventType, function(e) {
            eventsReceived++;
            resultsDiv.innerHTML += '<p>Received event: <strong>' + eventType + '</strong></p><pre>' + e.data + '</pre>';
            
            // Close connection after receiving all expected events
            if (eventsReceived >= 3) {
              resultsDiv.innerHTML += '<p>All expected events received, closing connection.</p>';
              evtSource.close();
            }
          });
        });
        
        // Close the connection after 5 seconds if not already closed
        setTimeout(() => {
          if (eventsReceived < 3) {
            resultsDiv.innerHTML += '<p>Timeout after 5 seconds, closing connection.</p>';
            evtSource.close();
          }
        }, 5000);
      } catch (error) {
        resultsDiv.innerHTML += '<p class="error">Error creating EventSource: ' + error.message + '</p>';
      }
    }
    
    // Function to test tool invocation
    async function testTool(url, toolName) {
      const resultsDiv = document.getElementById('results');
      resultsDiv.innerHTML = '<h3>Testing Tool: ' + toolName + '</h3><p>Sending request to ' + url + '...</p>';
      
      const payload = {
        version: "v1",
        request: {
          type: "invoke",
          invoke: {
            tool: toolName
          }
        }
      };
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        resultsDiv.innerHTML += '<p>Response status: ' + response.status + '</p>';
        resultsDiv.innerHTML += '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
      } catch (error) {
        resultsDiv.innerHTML += '<p class="error">Error: ' + error.message + '</p>';
      }
    }
  </script>
</body>
</html>`;
    
    return new Response(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  // Serve simple-test.html
  if (url.pathname === '/simple-test.html') {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simple Clerk OAuth Test</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      border-bottom: 2px solid #f0f0f0;
      padding-bottom: 10px;
    }
    .card {
      background: #f9f9f9;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    button {
      background: #4a6cf7;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 15px;
      margin-right: 10px;
    }
    button:hover {
      background: #3a5ce6;
    }
  </style>
</head>
<body>
  <h1>Simple Clerk OAuth Test</h1>
  
  <div class="card">
    <p>This page will attempt to directly authorize with Clerk using the Claude.ai redirect URI.</p>
    <p><strong>NOTE:</strong> This will redirect you to the Claude.ai domain, which won't handle the request, but it will show if Clerk accepts the redirect URI.</p>
    <button id="authBtn">Start OAuth Flow with Claude Redirect</button>
  </div>

  <script>
    document.getElementById('authBtn').addEventListener('click', () => {
      // Create direct Clerk OAuth URL
      const authUrl = new URL('https://clerk.getscorecard.ai/oauth/authorize');
      
      // Add required parameters
      authUrl.searchParams.append('client_id', 'arIFvS0RRW3eK3gH');
      authUrl.searchParams.append('redirect_uri', 'https://claude.ai/oauth/callback');
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('state', 'test-' + Math.random().toString(36).substring(2));
      authUrl.searchParams.append('scope', 'profile email scorecard.api');
      
      // Redirect to Clerk
      window.location.href = authUrl.toString();
    });
  </script>
</body>
</html>`;
    
    return new Response(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  // Serve test-callback.html
  if (url.pathname === '/test-callback.html') {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OAuth Callback Test</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      border-bottom: 2px solid #f0f0f0;
      padding-bottom: 10px;
    }
    .card {
      background: #f9f9f9;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    pre {
      background: #f0f0f0;
      padding: 10px;
      border-radius: 5px;
      overflow-x: auto;
    }
    .success {
      color: green;
    }
    .error {
      color: red;
    }
  </style>
</head>
<body>
  <h1>OAuth Callback Received</h1>
  
  <div class="card">
    <h2>Authorization Code</h2>
    <div id="codeDisplay"></div>
  </div>

  <div class="card">
    <h2>Token Exchange</h2>
    <button id="exchangeBtn">Exchange Authorization Code for Token</button>
    <div id="tokenResult"></div>
  </div>

  <script>
    // Get the authorization code from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    
    const codeDisplay = document.getElementById('codeDisplay');
    const exchangeBtn = document.getElementById('exchangeBtn');
    const tokenResult = document.getElementById('tokenResult');
    
    // Display the code or error
    if (code) {
      codeDisplay.innerHTML = \`<p class="success">Authorization code received: <code>\${code}</code></p>\`;
      if (state) {
        codeDisplay.innerHTML += \`<p>State: <code>\${state}</code></p>\`;
      }
    } else if (error) {
      codeDisplay.innerHTML = \`<p class="error">Error: \${error}</p>\`;
      if (errorDescription) {
        codeDisplay.innerHTML += \`<p class="error">Description: \${errorDescription}</p>\`;
      }
      exchangeBtn.disabled = true;
    } else {
      codeDisplay.innerHTML = '<p class="error">No authorization code found in the URL.</p>';
      exchangeBtn.disabled = true;
    }
    
    // Function to exchange the code for a token
    async function exchangeCode() {
      const serverUrl = 'https://scorecard-mcp.dare-d5b.workers.dev';
      const tokenEndpoint = \`\${serverUrl}/oauth/token\`;
      
      try {
        const response = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: window.location.origin + window.location.pathname,
            client_id: 'arIFvS0RRW3eK3gH',
            client_secret: '8mZZuOrp28hIwnDOVNaOJhBRceBuJ7pn'
          })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          tokenResult.innerHTML = \`<p class="success">Token received!</p><pre>\${JSON.stringify(data, null, 2)}</pre>\`;
        } else {
          tokenResult.innerHTML = \`<p class="error">Error exchanging code for token:</p><pre>\${JSON.stringify(data, null, 2)}</pre>\`;
        }
      } catch (error) {
        tokenResult.innerHTML = \`<p class="error">Error: \${error.message}</p>\`;
      }
    }
    
    // Add event listener to exchange button
    exchangeBtn.addEventListener('click', exchangeCode);
  </script>
</body>
</html>`;
    
    return new Response(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  // Serve test-oauth-flow.html
  if (url.pathname === '/test-oauth-flow.html') {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scorecard MCP OAuth Test</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      border-bottom: 2px solid #f0f0f0;
      padding-bottom: 10px;
    }
    .card {
      background: #f9f9f9;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    button {
      background: #4a6cf7;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 15px;
      margin-right: 10px;
    }
    button:hover {
      background: #3a5ce6;
    }
    button:disabled {
      background: #cccccc;
      cursor: not-allowed;
    }
    pre {
      background: #f0f0f0;
      padding: 10px;
      border-radius: 5px;
      overflow-x: auto;
    }
    .logs {
      height: 300px;
      overflow-y: auto;
      margin-top: 20px;
      border: 1px solid #ddd;
      padding: 10px;
      background: #f5f5f5;
      font-family: monospace;
    }
    .success {
      color: green;
    }
    .error {
      color: red;
    }
    .step {
      border-left: 3px solid #4a6cf7;
      padding-left: 15px;
      margin: 15px 0;
    }
  </style>
</head>
<body>
  <h1>Scorecard MCP OAuth Test Client</h1>
  
  <div class="card">
    <h2>MCP Server Configuration</h2>
    <p>Enter your MCP server URL:</p>
    <input type="text" id="serverUrl" value="https://scorecard-mcp.dare-d5b.workers.dev" style="width: 100%; padding: 8px; margin-bottom: 10px;">
  </div>

  <div class="card">
    <h2>Step 1: Discover OAuth Configuration</h2>
    <p>First, check the OAuth discovery endpoint to verify the server's OAuth configuration.</p>
    <button id="discoverBtn">Discover OAuth Config</button>
    <div id="discoveryResult"></div>
  </div>

  <div class="card">
    <h2>Step 2: Initiate OAuth Authorization</h2>
    <p>Start the OAuth flow by redirecting to the authorization endpoint.</p>
    <button id="authorizeBtn" disabled>Start OAuth Authorization</button>
    <div class="step">
      <p>This will redirect you to the authorization server. After login, you'll be redirected back with an authorization code.</p>
    </div>
  </div>

  <div class="card">
    <h2>Step 3: Exchange Code for Token</h2>
    <p>If you have an authorization code (after redirect), you can exchange it for an access token.</p>
    <div>
      <p>Authorization Code: <input type="text" id="authCode" style="width: 300px;"></p>
      <button id="exchangeBtn" disabled>Exchange for Token</button>
    </div>
    <div id="tokenResult"></div>
  </div>

  <div class="card">
    <h2>Step 4: Test MCP Authentication</h2>
    <p>Test using the access token with the MCP server.</p>
    <div>
      <p>Access Token: <input type="text" id="accessToken" style="width: 300px;"></p>
      <button id="testAuthBtn" disabled>Test Authentication</button>
    </div>
    <div id="authResult"></div>
  </div>

  <div class="card">
    <h2>Step 5: Introspect Available Tools</h2>
    <p>Check what tools are available through the MCP.</p>
    <button id="introspectBtn" disabled>Introspect Tools</button>
    <div id="toolsResult"></div>
  </div>

  <div class="card">
    <h2>Logs</h2>
    <button id="clearLogsBtn">Clear Logs</button>
    <div class="logs" id="logs"></div>
  </div>

  <script>
    const serverUrlInput = document.getElementById('serverUrl');
    const discoverBtn = document.getElementById('discoverBtn');
    const authorizeBtn = document.getElementById('authorizeBtn');
    const authCodeInput = document.getElementById('authCode');
    const exchangeBtn = document.getElementById('exchangeBtn');
    const accessTokenInput = document.getElementById('accessToken');
    const testAuthBtn = document.getElementById('testAuthBtn');
    const introspectBtn = document.getElementById('introspectBtn');
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    
    const discoveryResult = document.getElementById('discoveryResult');
    const tokenResult = document.getElementById('tokenResult');
    const authResult = document.getElementById('authResult');
    const toolsResult = document.getElementById('toolsResult');
    const logs = document.getElementById('logs');

    // Parse query parameters from URL
    const queryParams = new URLSearchParams(window.location.search);
    const code = queryParams.get('code');
    if (code) {
      authCodeInput.value = code;
      logMessage('Authorization code received from redirect: ' + code);
      
      // Auto-focus to the exchange button section
      document.getElementById('exchangeBtn').scrollIntoView();
      exchangeBtn.disabled = false;
    }

    // Function to log messages to the logs area
    function logMessage(message, isError = false) {
      const entry = document.createElement('div');
      entry.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
      if (isError) {
        entry.classList.add('error');
      }
      logs.appendChild(entry);
      logs.scrollTop = logs.scrollHeight;
    }

    // Function to make HTTP requests and handle responses
    async function makeRequest(url, options = {}) {
      try {
        logMessage(\`Making \${options.method || 'GET'} request to \${url}\`);
        const response = await fetch(url, options);
        const contentType = response.headers.get('Content-Type') || '';
        
        let data;
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }
        
        logMessage(\`Response status: \${response.status}\`);
        if (!response.ok) {
          throw new Error(\`Request failed with status \${response.status}: \${JSON.stringify(data)}\`);
        }
        
        return { ok: true, data, status: response.status };
      } catch (error) {
        logMessage(\`Error: \${error.message}\`, true);
        return { ok: false, error: error.message };
      }
    }

    // Discover OAuth configuration
    discoverBtn.addEventListener('click', async () => {
      const serverUrl = serverUrlInput.value.trim();
      if (!serverUrl) {
        logMessage('Please enter a server URL', true);
        return;
      }
      
      const discoveryEndpoint = \`\${serverUrl}/.well-known/oauth-authorization-server\`;
      const result = await makeRequest(discoveryEndpoint);
      
      if (result.ok) {
        discoveryResult.innerHTML = \`<pre>\${JSON.stringify(result.data, null, 2)}</pre>\`;
        
        // Store OAuth configuration for later use
        window.oauthConfig = result.data;
        
        // Enable the authorize button
        authorizeBtn.disabled = false;
        
        logMessage('OAuth discovery succeeded');
      } else {
        discoveryResult.innerHTML = \`<div class="error">Discovery failed: \${result.error}</div>\`;
      }
    });

    // Start OAuth authorization
    authorizeBtn.addEventListener('click', () => {
      const serverUrl = serverUrlInput.value.trim();
      if (!serverUrl) {
        logMessage('Please enter a server URL', true);
        return;
      }
      
      // Create a random state value for security
      const state = Math.random().toString(36).substring(2, 15);
      
      // Create a code verifier and challenge for PKCE
      const generateCodeVerifier = () => {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => 
          ('0' + (byte & 0xFF).toString(16)).slice(-2)
        ).join('');
      };
      
      const codeVerifier = generateCodeVerifier();
      
      // Generate code challenge (for simplicity using the verifier as the challenge)
      // In a real app, you'd hash this with SHA-256 and base64 encode
      const codeChallenge = codeVerifier;
      
      // Store these in localStorage for when we get redirected back
      localStorage.setItem('oauth_state', state);
      localStorage.setItem('oauth_code_verifier', codeVerifier);
      
      // Constructing the authorization URL
      const authUrl = new URL(\`\${serverUrl}/oauth/authorize\`);
      authUrl.searchParams.append('client_id', 'arIFvS0RRW3eK3gH');
      authUrl.searchParams.append('redirect_uri', 'https://claude.ai/oauth/callback');
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('scope', 'profile email scorecard.api');
      authUrl.searchParams.append('code_challenge', codeChallenge);
      authUrl.searchParams.append('code_challenge_method', 'plain');
      
      logMessage(\`Redirecting to authorization URL: \${authUrl.toString()}\`);
      
      // Redirect to the authorization server
      window.location.href = authUrl.toString();
    });

    // Exchange authorization code for access token
    exchangeBtn.addEventListener('click', async () => {
      const serverUrl = serverUrlInput.value.trim();
      const authCode = authCodeInput.value.trim();
      
      if (!serverUrl || !authCode) {
        logMessage('Please enter server URL and authorization code', true);
        return;
      }
      
      // Get the stored code verifier
      const codeVerifier = localStorage.getItem('oauth_code_verifier');
      if (!codeVerifier) {
        logMessage('Code verifier not found in storage. Start from Step 1.', true);
        return;
      }
      
      const tokenEndpoint = \`\${serverUrl}/oauth/token\`;
      const body = new URLSearchParams();
      body.append('grant_type', 'authorization_code');
      body.append('code', authCode);
      body.append('redirect_uri', 'https://claude.ai/oauth/callback');
      body.append('client_id', 'arIFvS0RRW3eK3gH');
      body.append('client_secret', '8mZZuOrp28hIwnDOVNaOJhBRceBuJ7pn');
      body.append('code_verifier', codeVerifier);
      
      const result = await makeRequest(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body
      });
      
      if (result.ok) {
        tokenResult.innerHTML = \`<pre>\${JSON.stringify(result.data, null, 2)}</pre>\`;
        
        // Store the access token
        const accessToken = result.data.access_token;
        if (accessToken) {
          accessTokenInput.value = accessToken;
          testAuthBtn.disabled = false;
          introspectBtn.disabled = false;
        }
        
        logMessage('Token exchange succeeded');
      } else {
        tokenResult.innerHTML = \`<div class="error">Token exchange failed: \${result.error}</div>\`;
      }
    });

    // Test MCP authentication
    testAuthBtn.addEventListener('click', async () => {
      const serverUrl = serverUrlInput.value.trim();
      const accessToken = accessTokenInput.value.trim();
      
      if (!serverUrl || !accessToken) {
        logMessage('Please enter server URL and access token', true);
        return;
      }
      
      const authRequest = {
        version: "v1",
        type: "auth_request",
        credentials: {
          type: "bearer",
          token: accessToken
        }
      };
      
      const result = await makeRequest(\`\${serverUrl}/mcp\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authRequest)
      });
      
      if (result.ok) {
        authResult.innerHTML = \`<pre>\${JSON.stringify(result.data, null, 2)}</pre>\`;
        logMessage('Authentication test succeeded');
      } else {
        authResult.innerHTML = \`<div class="error">Authentication test failed: \${result.error}</div>\`;
      }
    });

    // Introspect tools
    introspectBtn.addEventListener('click', async () => {
      const serverUrl = serverUrlInput.value.trim();
      const accessToken = accessTokenInput.value.trim();
      
      if (!serverUrl) {
        logMessage('Please enter a server URL', true);
        return;
      }
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (accessToken) {
        headers['Authorization'] = \`Bearer \${accessToken}\`;
      }
      
      const introspectRequest = {
        version: "v1",
        request: {
          type: "introspect"
        }
      };
      
      const result = await makeRequest(\`\${serverUrl}/mcp\`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(introspectRequest)
      });
      
      if (result.ok) {
        toolsResult.innerHTML = \`<pre>\${JSON.stringify(result.data, null, 2)}</pre>\`;
        logMessage('Tool introspection succeeded');
      } else {
        toolsResult.innerHTML = \`<div class="error">Tool introspection failed: \${result.error}</div>\`;
      }
    });

    // Clear logs
    clearLogsBtn.addEventListener('click', () => {
      logs.innerHTML = '';
      logMessage('Logs cleared');
    });

    // Check if we have code from a redirect
    if (authCodeInput.value) {
      exchangeBtn.disabled = false;
    }

    // Initial log message
    logMessage('OAuth test client initialized. Start by discovering the OAuth configuration.');
  </script>
</body>
</html>`;
    
    return new Response(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  // OAuth Well-Known Endpoint for discovery
  if (url.pathname === '/.well-known/oauth-authorization-server') {
    // Fixed Clerk issuer for Scorecard
    const clerkIssuer = `https://clerk.getscorecard.ai`;
    
    console.log("OAuth discovery requested, using Clerk issuer:", clerkIssuer);
    
    return new Response(JSON.stringify({
      issuer: clerkIssuer,
      authorization_endpoint: `${clerkIssuer}/oauth/authorize`,
      token_endpoint: `${clerkIssuer}/oauth/token`,
      jwks_uri: `${clerkIssuer}/.well-known/jwks.json`,
      scopes_supported: ["profile", "email", "scorecard.api"],
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
    logWithContext('info', "OAuth authorization request received", {
      url: request.url,
      method: request.method,
      params: Object.fromEntries([...url.searchParams.entries()]),
      headers: Object.fromEntries([...request.headers.entries()])
    });
    
    // Get the parameters from the query
    let redirectUri = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state');
    const codeChallenge = url.searchParams.get('code_challenge');
    const codeChallengeMethod = url.searchParams.get('code_challenge_method');
    const responseType = url.searchParams.get('response_type');
    const scope = url.searchParams.get('scope');
    
    // Always use the Claude redirect URI for testing - this ensures we're using the exact URL registered in Clerk
    const originalRedirectUri = redirectUri;
    redirectUri = 'https://claude.ai/oauth/callback';
    
    logWithContext('info', "Using Claude.ai OAuth callback URL", {
      originalRedirectUri,
      forcedRedirectUri: redirectUri
    });
    
    if (!redirectUri) {
      console.log("Error: Missing redirect_uri parameter");
      return new Response('Missing redirect_uri parameter', { status: 400 });
    }
    
    // Use a fixed Clerk instance URL for Scorecard
    const clerkInstance = `https://clerk.getscorecard.ai`;
    
    // Build the authorization URL for Clerk
    const clerkAuthUrl = new URL(`${clerkInstance}/oauth/authorize`);
    
    // Add all the required parameters
    clerkAuthUrl.searchParams.append('client_id', env.CLERK_OAUTH_CLIENT_ID || 'arIFvS0RRW3eK3gH');
    clerkAuthUrl.searchParams.append('redirect_uri', redirectUri);
    clerkAuthUrl.searchParams.append('response_type', responseType || 'code');
    
    if (state) {
      clerkAuthUrl.searchParams.append('state', state);
    }
    
    // If scope is provided, use it, but remove 'openid' if present
    if (scope) {
      const scopeArray = scope.split(' ').filter(s => s !== 'openid');
      clerkAuthUrl.searchParams.append('scope', scopeArray.join(' ') || 'profile email scorecard.api');
    } else {
      clerkAuthUrl.searchParams.append('scope', 'profile email scorecard.api');
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
      logWithContext('info', "OAuth token request received", {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries([...request.headers.entries()])
      });
      
      // Log the incoming token request for debugging
      const cloneRequest = request.clone();
      const body = await cloneRequest.text();
      
      // Try to parse the body if it's URL-encoded
      let parsedBody = {};
      try {
        const params = new URLSearchParams(body);
        parsedBody = Object.fromEntries(params.entries());
        // Mask sensitive values
        if (parsedBody.code) parsedBody.code = '***REDACTED***';
        if (parsedBody.client_secret) parsedBody.client_secret = '***REDACTED***';
      } catch (e) {
        parsedBody = { error: "Could not parse body" };
      }
      
      logWithContext('debug', "OAuth token request body", parsedBody);
      console.log("Token request body:", body);
      
      if (!env.CLERK_OAUTH_CLIENT_ID || !env.CLERK_OAUTH_CLIENT_SECRET) {
        console.error("Missing Clerk credentials");
        return new Response(JSON.stringify({ 
          error: 'server_error',
          error_description: 'OAuth server configuration error: Missing client ID or secret'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // Use a fixed Clerk instance URL for Scorecard
      const clerkInstance = `https://clerk.getscorecard.ai`;
      const tokenUrl = `${clerkInstance}/oauth/token`;
      
      console.log("Forwarding token request to:", tokenUrl);
      
      // We've already consumed the body for logging, so we need to create a new one
      // Parse the URL-encoded body to get the parameters
      const bodyParams = new URLSearchParams(body);
      
      // Ensure redirect_uri is always set to the Claude URI
      bodyParams.set('redirect_uri', 'https://claude.ai/oauth/callback');
      
      // Add client ID and secret if not present
      if (!bodyParams.has('client_id')) {
        bodyParams.set('client_id', env.CLERK_OAUTH_CLIENT_ID || 'arIFvS0RRW3eK3gH');
      }
      
      if (!bodyParams.has('client_secret')) {
        bodyParams.set('client_secret', env.CLERK_OAUTH_CLIENT_SECRET || '8mZZuOrp28hIwnDOVNaOJhBRceBuJ7pn');
      }
      
      console.log("Modified token request body:", bodyParams.toString());
      
      // Forward the modified request to Clerk
      const clerkResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams
      });
      
      // Return the response from Clerk
      const tokenData = await clerkResponse.json();
      
      // Log the response with sensitive data masked
      const sanitizedTokenData = { ...tokenData };
      if (sanitizedTokenData.access_token) sanitizedTokenData.access_token = '***REDACTED***';
      if (sanitizedTokenData.refresh_token) sanitizedTokenData.refresh_token = '***REDACTED***';
      if (sanitizedTokenData.id_token) sanitizedTokenData.id_token = '***REDACTED***';
      
      logWithContext('info', `Token response received from Clerk: ${clerkResponse.status}`, {
        status: clerkResponse.status,
        headers: Object.fromEntries([...clerkResponse.headers.entries()]),
        body: sanitizedTokenData
      });
      
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
  
  // Stainless Tools endpoint removed
  
  // Handle MCP requests - support multiple paths
  if (url.pathname === '/mcp' || url.pathname === '/sse' || url.pathname === '/mcp/no-auth') {
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
        logWithContext('info', "Setting up SSE connection for MCP", {
          url: request.url,
          headers: Object.fromEntries([...request.headers.entries()])
        });
        
        // Create streaming response with custom transformer
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        
        // Send initial events
        const encoder = new TextEncoder();
        
        // Function to write SSE events
        const writeEvent = async (event, data) => {
          logWithContext('debug', `Writing SSE event: ${event}`, data);
          await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        
        // Write the standard MCP initialization sequence
        const writeInitEvents = async () => {
          // Step 1: Connection ready event
          await writeEvent('ready', {
            version: "v1",
            type: "connection_status",
            connection_status: {
              status: "connected"
            }
          });
          
          // Step 2: Authentication success event
          // Add detailed log for debugging
          const authResponse = {
            version: "v1",
            type: "auth_response",
            auth_response: url.pathname === '/mcp/no-auth'
              ? {
                  // No authentication for the no-auth endpoint
                  type: "none",
                  status: "success"
                }
              : {
                  // OAuth authentication for regular endpoints
                  type: "oauth",
                  status: "success",
                  oauth: {
                    server: `https://${request.headers.get('host') || "scorecard-mcp.dare-d5b.workers.dev"}`
                  }
                }
          };
          
          logWithContext('info', "Sending authentication response event", authResponse);
          await writeEvent('authentication', authResponse);
          
          // Step 3: Available tools event
          await writeEvent('tools', {
            version: "v1",
            type: "tools",
            tools: [
              {
                name: "get_projects",
                description: "Get all projects from Scorecard"
              },
              {
                name: "get_records",
                description: "Get records from Scorecard"
              }
            ]
          });
          
          // Keep the connection alive with a comment
          await writer.write(encoder.encode(`: ping\n\n`));
          
          // In Cloudflare Workers, we can't keep the connection alive indefinitely,
          // so we close it after sending the initial events
          logWithContext('info', "Completed SSE initialization sequence, closing connection gracefully");
          await writer.close();
        };
        
        // Execute the initialization asynchronously
        writeInitEvents().catch(error => {
          logWithContext('error', "Error writing SSE events", error);
          writer.close();
        });
        
        // Return the readable stream
        return new Response(readable, {
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
    const url = new URL(request.url);
    const startTime = Date.now();
    
    try {
      const response = await handleRequest(request, env);
      
      // Log the response timing
      const duration = Date.now() - startTime;
      logWithContext('debug', `Response sent: ${request.method} ${url.pathname} ${response.status} (${duration}ms)`);
      
      return response;
    } catch (error) {
      // Log any unhandled errors
      logWithContext('error', `Unhandled error: ${request.method} ${url.pathname}`, error);
      
      // Return a graceful error response
      return new Response(JSON.stringify({ 
        error: 'server_error',
        message: 'An unexpected error occurred'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};