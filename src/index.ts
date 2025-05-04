import { init, server } from "scorecard-ai-mcp/server";
import Scorecard from "scorecard-ai";
import { Hono } from "hono";
import { McpAgent } from "agents/mcp";
// import { DurableMCP } from "workers-mcp"; Not even a valid import?
//import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import OAuthProvider, { type OAuthHelpers } from "@cloudflare/workers-oauth-provider";

import type { UserProps } from "./types";
import { authorize, callback, confirmConsent, tokenExchangeCallback } from "./auth";

export class AuthenticatedMCP extends McpAgent<UserProps, Env> {

	server = server;

	async init() {
		// Add additional tool for debugging. This will show the current user's claims and the Auth0 tokens.
		server.tool("whoami", "Get the current user's details", {}, async () => ({
			content: [{ type: "text", text: JSON.stringify(this.props.claims, null, 2) }],
		}));


		const client = new Scorecard({
			// TODO: This @ts-ignore shouldn't be required, the type is defined in UserProps
			// @ts-ignore
			bearerToken: this.props.tokenSet.accessToken,
		})

		init({ server: this.server, client});
	}
}

// export default {
// 	fetch(request: Request, env: Env, ctx: ExecutionContext) {
// 		const url = new URL(request.url);

// 		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
// 			// @ts-ignore
// 			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
// 		}

// 		if (url.pathname === "/mcp") {
// 			// @ts-ignore
// 			return MyMCP.serve("/mcp").fetch(request, env, ctx);
// 		}

// 		return new Response("Not found", { status: 404 });
// 	},
// };

// Initialize the Hono app with the routes for the OAuth Provider.
const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();
app.get("/authorize", authorize);
app.post("/authorize/consent", confirmConsent);
app.get("/callback", callback);

export default new OAuthProvider({
	apiRoute: "/mcp",
	// TODO: fix these types
	// @ts-ignore
	apiHandler: AuthenticatedMCP.mount("/mcp"),
	// TODO: fix these types
	// @ts-ignore
	defaultHandler: app,
	authorizeEndpoint: "/authorize",
	tokenEndpoint: "/token",
	clientRegistrationEndpoint: "/register",
	tokenExchangeCallback,
});