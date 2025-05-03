import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { init, server } from "scorecard-ai-mcp/server";
import Scorecard from "scorecard-ai";
import { z } from "zod";

// Define environment interface (required to use this.env)
interface Env {
	SCORECARD_API_KEY: string;
}

// Define our MCP agent with tools
export class MyMCP extends McpAgent<Env> {

	server = server;

	async init() {
		const client = new Scorecard({
			bearerToken: this.env.SCORECARD_API_KEY
		})

		init({ server: this.server, client});
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			// @ts-ignore
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			// @ts-ignore
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
