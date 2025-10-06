import * as Sentry from "@sentry/node";

const RAILWAY_ENVIRONMENT =
  process.env.RAILWAY_ENVIRONMENT_NAME || "development";

const SENTRY_ENVIRONMENT = RAILWAY_ENVIRONMENT.startsWith("scorecard-pr")
  ? "preview"
  : RAILWAY_ENVIRONMENT;

const isLocalDevelopment = SENTRY_ENVIRONMENT === "development";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  enabled: !isLocalDevelopment,
  tracesSampleRate: 1.0,
  sendDefaultPii: true,
  enableLogs: true,
});
