import { createClerkClient } from "@clerk/backend";
import { AuthenticationError } from "../errors";
import { getLogger } from "../utils/logger";
const logger = getLogger();

/**
 * Returns the most recently updated organization Clerk ID for a given Clerk user ID.
 * An organization "update" is an update to its Clerk metadata (e.g. name), not its contents (e.g. not Testsets).
 * @throws AuthenticationError if the user has no organizations.
 */
async function getOrgIdFromUser(userId: string): Promise<string> {
  logger.info(
    `No org_id provided for user ${userId}, attempting to look up their most recent org`,
  );
  // Look up orgs associated with the user using the clerk backend client
  // if the user has multiple orgs, pick the one that was updated most recently
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  try {
    const organizations = await clerkClient.users.getOrganizationMembershipList(
      { userId },
    );

    if (organizations.data.length === 0) {
      throw new AuthenticationError("User does not belong to any organization");
    }

    // Select the most recently updated org
    let mostRecentOrg = organizations.data[0];
    for (const org of organizations.data) {
      if (org.updatedAt > mostRecentOrg.updatedAt) {
        mostRecentOrg = org;
      }
    }

    return mostRecentOrg.organization.id;
  } catch (error) {
    throw new AuthenticationError(
      `Failed to retrieve organization for user ${userId}`,
      undefined,
      "Could not determine user's organization",
    ).withCause(error);
  }
}

async function verifyOAuthAccessToken(token: string): Promise<{
  authType: "oat";
  userId: string;
  orgId: string;
}> {
  // Use Clerk REST API to validate the OAuth Access Token
  const response = await fetch(
    "https://api.clerk.com/oauth_applications/access_tokens/verify",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: token,
      }),
    },
  );

  if (!response.ok) {
    throw new AuthenticationError(
      `OAuth token verification failed with status ${response.status}`,
      undefined,
      "The OAuth token is invalid or could not be verified",
    );
  }

  const oauthTokenData = (await response.json()) as {
    subject?: string;
    [key: string]: unknown;
  };

  if (!oauthTokenData.subject) {
    throw new AuthenticationError(
      "OAuth Access Token does not contain a valid user ID",
      undefined,
      "The OAuth token is invalid or has no associated user",
    );
  }

  const userId = oauthTokenData.subject;
  const orgId = await getOrgIdFromUser(userId);

  return {
    authType: "oat",
    userId,
    orgId,
  };
}

// Example usage in getAuthInfoFromAuthHeader:
// if (token.startsWith("oat_")) {
//   // OAuth Access Token
//   return await verifyOAuthAccessToken(token);
// }
