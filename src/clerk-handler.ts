import type {
  AuthRequest,
  OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { fetchUpstreamAuthToken, getUpstreamAuthorizeUrl } from "./utils";
import { env } from "cloudflare:workers";
import {
  clientIdAlreadyApproved,
  parseRedirectApproval,
  renderApprovalDialog,
} from "./workers-oauth-utils";
import { Props } from "./types";

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();

app.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  const { clientId } = oauthReqInfo;
  if (!clientId) {
    return c.text("Invalid request", 400);
  }

  if (
    await clientIdAlreadyApproved(
      c.req.raw,
      oauthReqInfo.clientId,
      env.COOKIE_ENCRYPTION_KEY
    )
  ) {
    return redirectToClerk(c.req.raw, oauthReqInfo);
  }

  return renderApprovalDialog(c.req.raw, {
    client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
    server: {
      name: "Scorecard MCP Server",
      logo: "https://framerusercontent.com/images/ylkzg5JHpDoM1yElDL3EyPqIK8.svg",
      description: "Sign in to Scorecard to authorize this MCP client",
    },
    state: { oauthReqInfo }, // arbitrary data that flows through the form submission below
  });
});

app.post("/authorize", async (c) => {
  // Validates form submission, extracts state, and generates Set-Cookie headers to skip approval dialog next time
  const { state, headers } = await parseRedirectApproval(
    c.req.raw,
    env.COOKIE_ENCRYPTION_KEY
  );
  if (!state.oauthReqInfo) {
    return c.text("Invalid request", 400);
  }

  return redirectToClerk(c.req.raw, state.oauthReqInfo, headers);
});

async function redirectToClerk(
  request: Request,
  oauthReqInfo: AuthRequest,
  headers: Record<string, string> = {}
) {
  return new Response(null, {
    status: 302,
    headers: {
      ...headers,
      location: getUpstreamAuthorizeUrl({
        upstream_url: "https://clerk.getscorecard.ai/oauth/authorize",
        scope: "profile", // This should match a scope defined in the Clerk Dashboard -> Configure -> OAuth Applications
        grant_type: "authorization_code",
        client_id: env.CLERK_CLIENT_ID,
        redirect_uri: new URL("/callback", request.url).href,
        state: btoa(JSON.stringify(oauthReqInfo)),
      }),
    },
  });
}

/**
 * OAuth Callback Endpoint
 *
 * This route handles the callback from Clerk after user authentication.
 * It exchanges the temporary code for an access token, then stores some
 * user metadata & the auth token as part of the 'props' on the token passed
 * down to the client. It ends by redirecting the client back to _its_ callback URL
 */
app.get("/callback", async (c) => {
  // Get the oathReqInfo out of KV
  const oauthReqInfo = JSON.parse(
    atob(c.req.query("state") as string)
  ) as AuthRequest;
  if (!oauthReqInfo.clientId) {
    return c.text("Invalid state", 400);
  }

  // Exchange the code for an access token
  const [accessToken, errResponse] = await fetchUpstreamAuthToken({
    upstream_url: "https://clerk.getscorecard.ai/oauth/token",
    client_id: c.env.CLERK_CLIENT_ID,
    client_secret: c.env.CLERK_CLIENT_SECRET,
    code: c.req.query("code"),
    grant_type: "authorization_code",
    redirect_uri: new URL("/callback", c.req.url).href,
  });
  if (errResponse) {
    return errResponse;
  }

  // TODO: Where to get this?
  const userId = "dummyUser";

  // Return back to the MCP client a new token
  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReqInfo,
    userId: userId,
    metadata: {},
    scope: oauthReqInfo.scope,
    // Made available as this.props inside ScorecardAuthenticatedMCP
    props: {
      accessToken: accessToken,
    } as Props,
  });

  return Response.redirect(redirectTo);
});

export { app as ClerkHandler };
