import { Context } from "koishi";
import commands from "./commands";
import models from "./models";
import services from "./services";

export default function (ctx: Context) {
  ctx.plugin(models);
  ctx.plugin(services);
  ctx.plugin(commands);
}
