import "dotenv/config";
import { clerkClient, clerkMiddleware } from "@clerk/express";
import {
  mcpAuthClerk,
  protectedResourceHandlerClerk,
  authServerMetadataHandlerClerk,
  streamableHttpHandler,
} from "@clerk/mcp-tools/express";
import express from "express";
import cors from "cors";
import {
  initMcpServer,
  McpOptions,
  newMcpServer,
} from "scorecard-ai-mcp/server";
import { parseQueryOptions } from "scorecard-ai-mcp/options";
import * as Sentry from "@sentry/node";
import { readFileSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";

// Get the actual installed version of scorecard-ai-mcp
const require = createRequire(import.meta.url);
const scorecardModulePath = require.resolve("scorecard-ai-mcp/server");
const scorecardPackageJsonPath = join(
  dirname(scorecardModulePath),
  "package.json",
);
const scorecardAiMcpPackageJson = JSON.parse(
  readFileSync(scorecardPackageJsonPath, "utf8"),
);

// Determine the SDK environment from Railway deployment or default to local
const SDK_ENVIRONMENT =
  (process.env.RAILWAY_ENVIRONMENT_NAME as "production" | "staging") || "local";

// Configure Scorecard client with custom base URL or environment (only one can be provided)
const SDK_CLIENT_OPTIONS = {
  ...(process.env.SCORECARD_BASE_URL
    ? { baseURL: process.env.SCORECARD_BASE_URL }
    : {
        environment: SDK_ENVIRONMENT,
      }),
} as const;

/**
 * The URL of the MCP resource.
 * If the server is deployed on Railway, this is the connection URL of the MCP server.
 * If the server is running locally, this is null so that Clerk determines the resource URL itself.
 */
const MCP_RESOURCE_URL: string | null = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/mcp`
  : null;

const app = express();
// Enable CORS with WWW-Authenticate header for OAuth flow
app.use(cors({ exposedHeaders: ["WWW-Authenticate"] }));
// Attaches the Auth object to the request object under the `auth` key.
app.use(clerkMiddleware());
// Enable extended query string parsing for complex query params
app.set("query parser", "extended");
app.use(express.json());

/**
 * Returns an MCP server that is authenticated to the Oauth key's user and has Sentry logging.
 */
function createAuthenticatedServer(
  bearerToken: string,
  req: express.Request,
  res: express.Response,
) {
  const server = newMcpServer();

  // Parse MCP options from query parameters with Claude as default client
  let mcpOptions: McpOptions;
  try {
    mcpOptions = parseQueryOptions(
      {
        client: "claude",
      },
      req.query,
    );
  } catch (error) {
    // Return JSON-RPC error for invalid query parameters
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: `Invalid request`,
      },
    });
    return null;
  }

  // Register a custom MCP tool to retrieve authenticated user information
  // However, this is not discoverable by the client since Stainless's
  // initMcpServer ignores this tool.
  server.tool(
    "get_user_data",
    "Gets data about the Scorecard user that authorized this request",
    {},
    async (_, { authInfo }) => {
      // non-null assertion is safe here, mcpAuthClerk ensures presence
      const userId = authInfo!.extra!.userId! as string;
      const userData = await clerkClient.users.getUser(userId);

      return {
        content: [{ type: "text", text: JSON.stringify(userData) }],
      };
    },
  );

  const clientOptions = {
    ...SDK_CLIENT_OPTIONS,
    apiKey: bearerToken,
  } as const;

  // Initialize MCP server with Scorecard tools and configuration
  initMcpServer({
    server,
    clientOptions,
    mcpOptions,
  });

  // Wrap server with Sentry for error tracking
  return Sentry.wrapMcpServerWithSentry(server);
}

// If a user goes to one of these URLs in their browser instead of using the MCP client, show them a helpful message.
app.get(["/", "/mcp", "/http", "/sse"], (req, res) => {
  res.status(404).send(
    `
    To use the Scorecard MCP server, please add <code style="color:green">${MCP_RESOURCE_URL ?? "https://mcp.scorecard.io/mcp"}</code> to your MCP client.
    <br/>
    If your MCP client asks, set the transport method to Streamable HTTP.
    <br/>
    See the <a href='https://docs.scorecard.io/features/mcp'>documentation</a> for more information.
    `,
  );
});

// Main MCP endpoint - handles authenticated MCP protocol requests
app.post("/mcp", mcpAuthClerk, (req, res) => {
  // Clerk middleware attaches the Auth object to the request object under the `auth` key.
  const oauthToken = (req as unknown as { auth: { token: string } }).auth.token;
  const server = createAuthenticatedServer(oauthToken, req, res);
  if (!server) {
    return;
  }
  // Handle MCP request with streaming support
  return streamableHttpHandler(server)(req, res);
});

app.get("/health", async (_req, res) => {
  try {
    const mcpServer = newMcpServer();
    initMcpServer({
      server: mcpServer,
      clientOptions: {
        ...SDK_CLIENT_OPTIONS,
        apiKey: "ak_fake_api_key",
      },
      mcpOptions: {
        client: "claude",
      },
    });

    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      sdk_environment: SDK_ENVIRONMENT,
      sdk_version: scorecardAiMcpPackageJson.version,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      sdk_environment: SDK_ENVIRONMENT,
      sdk_version: scorecardAiMcpPackageJson.version,
    });
  }
});

// OAuth discovery endpoint for protected resource metadata
app.get(
  "/.well-known/oauth-protected-resource/mcp",
  // Specify the scopes that your MCP server needs here
  protectedResourceHandlerClerk({
    scopes_supported: ["email", "profile"],
    ...(MCP_RESOURCE_URL ? { resource: MCP_RESOURCE_URL } : {}),
  }),
);
// Legacy OAuth discovery endpoint for backward compatibility
// This is still often needed for clients that implement the older mcp spec
app.get(
  "/.well-known/oauth-authorization-server",
  authServerMetadataHandlerClerk,
);

// Configure Sentry error handler for Express
Sentry.setupExpressErrorHandler(app);

// Start server on configured port
const PORT = process.env.PORT || 6283;
app.listen(PORT);
console.log(
  `Scorecard remote MCP server is running on port ${PORT} and environment ${SDK_ENVIRONMENT}`,
);
