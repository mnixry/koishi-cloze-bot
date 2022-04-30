// organize-imports-ignore
import * as dotenv from "dotenv";
import { App, Logger } from "koishi";
import { inspect } from "util";

import onebot from "@koishijs/plugin-adapter-onebot";
import * as sqlite from "@koishijs/plugin-database-sqlite";
import console from "@koishijs/plugin-console";
import insight from "@koishijs/plugin-insight";
import dataview from "@koishijs/plugin-dataview";
import * as chat from "@koishijs/plugin-chat";
import sentry from "koishi-plugin-sentry";

import plugin from "./src";

dotenv.config();

if (process.env.LOG_LEVEL)
  Logger.levels.base = Logger[process.env.LOG_LEVEL.toUpperCase()];

Logger.formatters["o"] = (value, target?: Logger.Target) =>
  inspect(value, { colors: !!target?.colors, maxStringLength: 256 }).replace(
    /\s*\n\s*/g,
    " ",
  );

const app = new App({
  port: +(process.env.PORT || 3000),
  prettyErrors: true,
  autoAssign: true,
  autoAuthorize: (session) =>
    session.onebot?.sender.role === "admin" ||
    session.onebot?.sender.role === "owner"
      ? 2
      : 1,
});

app
  .plugin(onebot, {
    protocol: "ws-reverse",
    selfId: process.env.ONEBOT_SELF_ID,
  })
  .plugin(sqlite)
  .plugin(console)
  .plugin(dataview)
  .plugin(insight)
  .plugin(chat)
  .plugin(sentry, { dsn: process.env.SENTRY_DSN, logAsBreadcrumb: true });

app.plugin(plugin);

app.start();
