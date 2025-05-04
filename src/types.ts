import type { JWTPayload } from "jose";

export type UserProps = {
	claims: JWTPayload;
	tokenSet: {
		accessToken: string;
		idToken: string;
		refreshToken: string;
		accessTokenTTL?: number;
	};
};

export interface Env {
	CLERK_DOMAIN: string;
	CLERK_CLIENT_ID: string;
	CLERK_CLIENT_SECRET: string;
	CLERK_AUDIENCE: string;
	CLERK_SCOPE: string;
	NODE_ENV?: string;
}