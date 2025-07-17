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
      async (params, _) => {
        // Debug logging
        console.log("Tool called:", endpoint.tool.name);
        console.log("Params:", JSON.stringify(params, null, 2));

        // Extract authInfo from params (where it actually is)
        const authInfo = params.authInfo;

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

        // Get the access token
        const accessToken = authInfo.token;
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

        // Create the API URL (the regex removes excess trailing slashes)
        const baseURL =
          (
            process.env.NEXT_PUBLIC_BACKEND2_URL ?? "http://localhost:3000"
          ).replace(/\/+$/, "") + "/api/v2";
        console.log("Base URL:", baseURL);
        console.log("Access token:", accessToken);

        // Use the Scorecard client with Clerk OAuth Access token as API key
        // The client will automatically send it as Authorization: Bearer {token}
        const client = new Scorecard({
          apiKey: accessToken,
          baseURL: baseURL,
        });

        // Filter out MCP-specific parameters and any functions
        const {
          authInfo: _authInfo,
          signal: _signal,
          _meta,
          requestId: _requestId,
          ...rawApiParams
        } = params;

        // TODO: Create a Record object with the parameters, as expected by the API handler
        // TODO: Leaving this "Ensure we only pass serializable values" code in here for now,
        // but do not think it is correct
        const apiParams = Object.fromEntries(
          Object.entries(rawApiParams).filter(
            ([_, value]) =>
              typeof value !== "function" &&
              typeof value !== "undefined" &&
              typeof value !== "symbol",
          ),
        );

        console.log("Filtered API params:", JSON.stringify(apiParams, null, 2));

        const result = await endpoint.handler(client, undefined);
        return {
          content: [
            { type: "text", text: JSON.stringify(result.content, null, 2) },
          ],
        };
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
