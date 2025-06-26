import { verifyClerkToken } from "@clerk/mcp-tools/next";
import { auth, clerkClient } from "@clerk/nextjs/server";
import {
  createMcpHandler,
  experimental_withMcpAuth as withMcpAuth,
} from "@vercel/mcp-adapter";
import { endpoints } from "scorecard-ai-mcp/server";
import { Scorecard } from "scorecard-ai";

const clerk = await clerkClient();

const handler = createMcpHandler((server) => {
  // Add Scorecard API tools
  endpoints.forEach((endpoint) => {
    server.tool(
      endpoint.tool.name,
      endpoint.tool.description || "",
      endpoint.tool.inputSchema,
      async (params, { authInfo }) => {
        // Debug logging
        console.log("Tool called:", endpoint.tool.name);
        console.log("Params:", JSON.stringify(params, null, 2));

        // Check if user is authenticated
        if (!authInfo?.extra?.userId) {
          return {
            content: [
              {
                type: "text",
                text: `Error: User not authenticated. AuthInfo: ${JSON.stringify(authInfo)}`,
              },
            ],
          };
        }

        // Get the access token (should be a Clerk JWT)
        const accessToken = authInfo.extra?.accessToken || authInfo.token;
        if (!accessToken) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No access token available",
              },
            ],
          };
        }

        // Use the Scorecard client with JWT token
        // The Scorecard backend supports Clerk JWTs via Authorization header
        const client = new Scorecard({
          baseURL: process.env.NEXT_PUBLIC_API_URL + "/api/v2",
          // Custom fetch that adds the JWT token
          fetch: async (url: string | URL | Request, init?: RequestInit) => {
            const headers = new Headers(init?.headers);
            headers.set("Authorization", `Bearer ${accessToken}`);

            return fetch(url, {
              ...init,
              headers,
            });
          },
        });

        return endpoint.handler(client, params);
      },
    );
  });

  server.tool(
    "get-scorecard-user-data",
    "Gets data about the Scorecard user that authorized this request",
    {}, // tool parameters here if present
    async (_, { authInfo }) => {
      // non-null assertion is safe here, authHandler ensures presence
      const userId = authInfo!.extra!.userId! as string;
      const userData = await clerk.users.getUser(userId);

      return {
        content: [{ type: "text", text: JSON.stringify(userData) }],
      };
    },
  );
});

const authHandler = withMcpAuth(
  handler,
  async (_, token) => {
    const clerkAuth = await auth({ acceptsToken: "oauth_token" });
    return verifyClerkToken(clerkAuth, token);
  },
  { required: true },
);

export { authHandler as GET, authHandler as POST };