import { Context } from "koishi";
import { tasks } from "./services";

export default function (ctx: Context) {
  ctx
    .command("quiz.config", { authority: 2 })
    .option("welcomeMsg", "-w <msg:text> 设置欢迎消息")
    .option("quizTimeout", "-t <seconds:number> 设置答题超时时间, 单位为秒")
    .option("quizRetries", "-r <number:number> 设置最大答题次数")
    .option(
      "rejoinDelay",
      "-d <seconds:number> 设置重新加入最小时间间隔, 单位为秒",
    )
    .action(async ({ session, options }) => {
      if (!session?.channelId || !session.platform) {
        await session?.send("该指令只能在群组中使用");
        return;
      }

      const channel = await ctx.model.getChannel(
        session.platform,
        session.channelId,
      );

      if (options?.welcomeMsg) channel.welcomeMsg = options.welcomeMsg.trim();
      if (options?.quizTimeout)
        channel.quizTimeout = options.quizTimeout * 1000;
      if (options?.quizRetries)
        channel.quizRetries = options.quizRetries * 1000;
      if (options?.rejoinDelay)
        channel.rejoinDelay = options.rejoinDelay * 1000;

      await ctx.model.setChannel(session.platform, session.channelId, {
        welcomeMsg: channel.welcomeMsg,
        quizTimeout: channel.quizTimeout,
        quizRetries: channel.quizRetries,
        rejoinDelay: channel.rejoinDelay,
      });

      session.send(`答题设置修改完成, 当前设置为:
        欢迎消息: ${channel.welcomeMsg || "无"}
        答题超时: ${channel.quizTimeout / 1000} 秒
        最大答题次数: ${channel.quizRetries} 次
        重新加入最小时间间隔: ${channel.rejoinDelay / 1000} 秒`);
    });

  ctx
    .command("quiz.add <title:text> 添加题目", { authority: 2 })
    .option("correct", "-t <correct:string> 设置正确答案")
    .option(
      "incorrect",
      "-i <incorrect:string> 设置错误答案, 多个用英文逗号分割",
    )
    .action(async ({ options, session }, title) => {
      if (!options?.correct) {
        session?.send("请指定正确答案");
        return;
      } else if (!options.incorrect) {
        session?.send("请指定错误答案, 用英文逗号 , 隔开");
        return;
      } else if (!session?.channelId) {
        session?.send("该指令只能在群聊内使用");
        return;
      }

      const result = await ctx.model.create("quizzes", {
        channelId: session?.channelId,
        question: title.trim(),
        wrongs: options.incorrect.split(",").map((x) => x.trim()),
        correct: options.correct.trim(),
        time: new Date(),
      });

      await session?.send(`添加成功, quiz id: ${result.id}`);
    });

  ctx
    .command("quiz.list 列出题目列表", { authority: 2 })
    .action(async ({ session }) => {
      if (!session?.channelId) {
        session?.send("该指令只能在群聊内使用");
        return;
      }

      const quizzes = await ctx.model.get("quizzes", {
        channelId: session?.channelId,
      });

      if (!quizzes.length) {
        session?.send("暂无题目");
        return;
      }

      const quizList = quizzes
        .map((x) => `id=${x.id}, ${x.question}`)
        .join("\n");

      session?.send(`当前题目列表:\n${quizList}`);
    });

  ctx
    .command("quiz.get <id:number> 获取题目信息", { authority: 2 })
    .action(async ({ session }, id) => {
      if (!session?.channelId) {
        session?.send("该指令只能在群聊内使用");
        return;
      }

      const [quiz] = await ctx.model.get("quizzes", {
        id: id,
        channelId: session?.channelId,
      });

      if (!quiz || quiz.channelId !== session?.channelId) {
        session?.send("暂无题目");
        return;
      }

      session?.send(
        `id=${quiz.id}, ${quiz.question} 
        正确答案: ${quiz.correct} 
        错误答案: ${quiz.wrongs.join()}`,
      );
    });

  ctx
    .command("quiz.delete <id:number> 删除题目", { authority: 2 })
    .action(async ({ session }, id) => {
      if (!session?.channelId) {
        session?.send("该指令只能在群聊内使用");
        return;
      }

      const [quiz] = await ctx.model.get("quizzes", {
        id,
        channelId: session?.channelId,
      });

      if (!quiz) {
        session?.send("该题目不存在");
        return;
      }

      await ctx.model.remove("quizzes", quiz.id);
      await ctx.model.remove("quizLogs", { quizId: quiz.id });

      session?.send("删除成功");
    });

  ctx
    .command("quiz.list-log 最近答题记录", { authority: 2 })
    .option("limit", "-l <number:number> 设置记录条数", { fallback: 5 })
    .action(async ({ session, options }) => {
      if (!session?.channelId) {
        session?.send("该指令只能在群聊内使用");
        return;
      }

      const quizzes = await ctx.model
        .get(
          "quizzes",
          { channelId: session?.channelId },
          { sort: { time: "asc" } },
        )
        .then((result) => new Map(result.map((x) => [x.id, x])));

      const logs = await ctx.model.get(
        "quizLogs",
        { quizId: [...quizzes.keys()] },
        { limit: options?.limit, sort: { time: "desc" } },
      );

      if (!logs.length) {
        session?.send("暂无答题记录");
        return;
      }

      const quizList = logs
        .map(
          (x) =>
            `id=${x.id}, user=${x.userId}
              quizId=${x.quizId} quiz=${quizzes.get(x.quizId)?.question}
              time=${x.time.toLocaleString()}, status=${x.status}`,
        )
        .join("\n");

      session?.send(`最近答题记录:\n${quizList}`);
    });

  ctx
    .command("quiz.approve <id:number> 手动通过一个答题", { authority: 2 })
    .action(async ({ session }, id) => {
      if (!session?.channelId) {
        session?.send("该指令只能在群聊内使用");
        return;
      }

      const log = tasks.get(id);
      const [quiz] = await ctx.model.get("quizzes", {
        id: log?.quizId,
        channelId: session?.channelId,
      });
      if (!log || !quiz) {
        session?.send("该答题记录不存在");
        return;
      }

      log.status = "accepted";
      await log.$update();

      session?.send("手动通过成功");
    });
}
