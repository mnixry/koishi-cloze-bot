import { Logger } from "koishi";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: "development" | "production";
      LOG_LEVEL?: Logger.Type;
      ONEBOT_SELF_ID?: string;
      PORT?: string;
      SENTRY_DSN?: string;
    }
  }
}

export {};
