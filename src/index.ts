import { init, server } from "scorecard-ai-mcp/server";
import Scorecard from "scorecard-ai";
import { Hono } from "hono";
import { McpAgent } from "agents/mcp";
import OAuthProvider, {
  type OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import {
  authorize,
  callback,
  confirmConsent,
  tokenExchangeCallback,
} from "./clerk";
import type { UserProps } from "./types";

export class ScorecardAuthenticatedMCP extends McpAgent<UserProps, Env> {
  server = server;

  async init() {
    // TODO: Debug log, remove later
    console.log("Payload available: " + JSON.stringify(this.props.claims));
    // @ts-ignore TODO: why
    console.log("Token for Scorecard: " + this.props.tokenSet.idToken);

    const client = new Scorecard({
      // TODO: Determine why typescript doesn't like this
      // @ts-ignore
      bearerToken: this.props.tokenSet.idToken,
    });

    init({ server: this.server, client });
  }
}

// Initialize the Hono app with the routes for the OAuth Provider.
const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();
app.get("/authorize", authorize);
app.post("/authorize/consent", confirmConsent);
app.get("/callback", callback);

export default new OAuthProvider({
  apiRoute: "/sse",
  // TODO: determine why TS doesn't like these
  // @ts-ignore
  apiHandler: ScorecardAuthenticatedMCP.mount("/sse"),
  // @ts-ignore
  defaultHandler: app,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  tokenExchangeCallback,
});
