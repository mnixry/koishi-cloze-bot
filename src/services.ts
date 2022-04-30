import { Context, observe, segment, type Observed } from "koishi";
import type { QuizLogs } from "./models";
import {
  COMPLETE_QUIZ_HINT_MSG,
  CORRECT_ANSWER_MSG,
  DEFAULT_WELCOME_MSG,
  IN_JOIN_DELAY_KICK_MSG,
  MAX_RETRIES_EXCEED_KICK_MSG,
  TIMEOUT_KICK_MSG,
  WRONG_ANSWER_FORMAT_MSG,
  WRONG_ANSWER_MSG,
} from "./strings";

function choice<T>(array: T[]): T {
  const index = Math.floor(Math.random() * array.length);
  return array[index];
}

function shuffle<T extends unknown[]>(array: T): T {
  let currentIndex = array.length,
    randomIndex: number;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
}

export const tasks = new Map<number, Observed<QuizLogs>>();

export default function (ctx: Context) {
  ctx.on("guild-member-added", async (session) => {
    const channel = await ctx.database.getChannel(
      session.platform!,
      session.channelId!,
    );

    const quizzes = await ctx.database.get("quizzes", {
      channelId: channel.id,
    });
    if (quizzes.length <= 0) return;

    const [latestLog] = await ctx.database.get(
      "quizLogs",
      { userId: session.userId },
      { sort: { time: "desc" } },
    );
    if (
      latestLog &&
      latestLog.time.getTime() + channel.rejoinDelay > Date.now() &&
      (latestLog.status === "failed" || latestLog.status === "timeout")
    ) {
      await session.send(segment.at(session.userId!) + IN_JOIN_DELAY_KICK_MSG);
      await session.onebot?.setGroupKick(session.channelId!, session.userId!);
      return;
    }

    await session.send(
      segment.at(session.userId!) + (channel.welcomeMsg ?? DEFAULT_WELCOME_MSG),
    );

    const log = observe(
      await ctx.database.create("quizLogs", {
        userId: session.userId,
        status: "waiting",
        time: new Date(),
      }),
      async (diff) => {
        console.log("update", diff);
        await ctx.database.set("quizLogs", log.id, {
          ...diff,
          time: new Date(),
        });
        switch (diff.status) {
          case "accepted":
            await session.send(
              segment.at(session.userId!) + CORRECT_ANSWER_MSG,
            );
            clearTimeout(timer);
            break;
          case "failed":
            await session.send(
              segment.at(session.userId!) + MAX_RETRIES_EXCEED_KICK_MSG,
            );
            await session.onebot?.setGroupKick(
              channel.id,
              session.onebot.user_id!,
            );
            break;
          case "timeout":
            await session.send(segment.at(session.userId!) + TIMEOUT_KICK_MSG);
            await session.onebot?.setGroupKick(
              channel.id,
              session.onebot.user_id!,
            );
            break;
        }
      },
    );
    const timer = setTimeout(
      () => (log.status = "timeout"),
      channel.quizTimeout,
    );

    tasks.set(log.id, log);
    setTimeout(
      () => tasks.delete(log.id),
      channel.quizTimeout + channel.rejoinDelay,
    );

    let retries = 0;

    for (; retries < channel.quizRetries; retries++) {
      const quiz = choice(quizzes),
        choices = shuffle([quiz.correct, ...quiz.wrongs]),
        [answer] = choices
          .map((v, i) => [i, v] as const)
          .find(([, v]) => v === quiz.correct)!;

      [log.quizId, log.quizData, log.quizAnswer] = [quiz.id, choices, answer];

      await session.send(
        segment.at(session.userId!) +
          `(${log.id})` +
          COMPLETE_QUIZ_HINT_MSG +
          choices.map((v, i) => `${i + 1}. ${v}`).join("\n"),
      );

      const userAnswer = await session
        .prompt(channel.quizTimeout)
        .catch(() => undefined);

      if (log.status === "accepted") break; // if accepted outer, break loop

      if (userAnswer === undefined) {
        log.status = "timeout";
        break;
      }

      if (!Number.isInteger(+userAnswer) || +userAnswer > choices.length) {
        await session.send(
          segment.at(session.userId!) + WRONG_ANSWER_FORMAT_MSG,
        );
        continue;
      }

      if (+userAnswer - 1 === answer) {
        log.status = "accepted";
        break;
      } else {
        await session.send(segment.at(session.userId!) + WRONG_ANSWER_MSG);
      }
    }

    if (retries >= channel.quizRetries) {
      log.status = "failed";
    }

    await log.$update();
  });

  ctx.on("guild-deleted", async ({ channelId }) => {
    const quizIds = await ctx.model
      .get("quizzes", { channelId })
      .then((v) => v.map((v) => v.id));
    await ctx.model.remove("quizzes", { id: quizIds });
    await ctx.model.remove("quizLogs", { quizId: quizIds });
  });
}
