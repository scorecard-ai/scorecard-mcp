import { init, server } from "scorecard-ai-mcp/server";
import Scorecard from "scorecard-ai";
import { McpAgent } from "agents/mcp";
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { ClerkHandler } from "./clerk-handler";
import type { Props } from "./types";

export class ScorecardAuthenticatedMCP extends McpAgent<Props, Env> {
  server = server;

  async init() {
    console.log(
      "Using this token to call Scorecard: " + this.props.accessToken
    );

    const client = new Scorecard({
      // TODO: Determine why typescript doesn't like this
      // @ts-ignore
      bearerToken: this.props.accessToken,
    });

    init({ server: this.server, client });
  }
}

export default new OAuthProvider({
  apiRoute: "/sse",
  // @ts-ignore TODO: determine why TS doesn't like these
  apiHandler: ScorecardAuthenticatedMCP.mount("/sse"),
  // @ts-ignore
  defaultHandler: ClerkHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
