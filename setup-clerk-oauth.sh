#!/bin/bash
# Script to set up Clerk OAuth credentials in Cloudflare

# Check if environment variables are set
if [ -z "$CLERK_SECRET_KEY" ] || [ -z "$CLERK_PUBLISHABLE_KEY" ] || [ -z "$CLERK_OAUTH_CLIENT_ID" ] || [ -z "$CLERK_OAUTH_CLIENT_SECRET" ]; then
  echo "Error: Clerk credentials not found in environment variables."
  echo "Please set the following environment variables:"
  echo "  CLERK_SECRET_KEY"
  echo "  CLERK_PUBLISHABLE_KEY"
  echo "  CLERK_OAUTH_CLIENT_ID"
  echo "  CLERK_OAUTH_CLIENT_SECRET"
  echo "You can also run this script with the values provided directly:"
  echo "  CLERK_SECRET_KEY=your_key CLERK_PUBLISHABLE_KEY=your_key ... ./setup-clerk-oauth.sh"
  exit 1
fi

# Set Clerk credentials in Cloudflare
echo "Setting Clerk Secret Key..."
echo "$CLERK_SECRET_KEY" | npx wrangler secret put CLERK_SECRET_KEY

echo "Setting Clerk Publishable Key..."
echo "$CLERK_PUBLISHABLE_KEY" | npx wrangler secret put CLERK_PUBLISHABLE_KEY

echo "Setting Clerk OAuth Client ID..."
echo "$CLERK_OAUTH_CLIENT_ID" | npx wrangler secret put CLERK_OAUTH_CLIENT_ID

echo "Setting Clerk OAuth Client Secret..."
echo "$CLERK_OAUTH_CLIENT_SECRET" | npx wrangler secret put CLERK_OAUTH_CLIENT_SECRET

echo "All Clerk secrets have been set up in Cloudflare Workers."
echo "Your MCP server is now configured for OAuth authentication."