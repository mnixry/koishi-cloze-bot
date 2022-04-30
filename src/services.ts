import { Context, segment } from "koishi";
import {
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

export default function (ctx: Context) {
  ctx.on("guild-member-added", async (session) => {
    const channel = await ctx.database.getChannel(
      session.platform!,
      session.channelId!,
    );
    const quizzes = await ctx.database.get("quizzes", {
      channelId: session.channelId,
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
      latestLog.status === "failed"
    ) {
      await session.send(segment.at(session.userId!) + IN_JOIN_DELAY_KICK_MSG);
      await session.onebot?.setGroupKick(session.channelId!, session.userId!);
    }

    await session.send(
      segment.at(session.userId!) + (channel.welcomeMsg ?? DEFAULT_WELCOME_MSG),
    );

    for (let retries = 0; retries <= channel.quizRetries; retries++) {
      const quiz = choice(quizzes),
        choices = shuffle([quiz.correct, ...quiz.wrongs]),
        [answerIndex] = choices
          .map((v, i) => [i, v] as const)
          .find(([, v]) => v === quiz.correct)!;

      const { id: logId } = await ctx.database.create("quizLogs", {
        quizId: quiz.id,
        quizData: choices,
        quizAnswer: answerIndex,
        userId: session.userId,
        status: "waiting",
        time: new Date(),
      });
      await session.send(choices.map((v, i) => `${i + 1}. ${v}`).join("\n"));

      const userAnswer = await session
        .prompt(channel.quizTimeout)
        .catch(() => undefined);

      if (userAnswer === undefined) {
        await ctx.database.set("quizLogs", logId, {
          status: "failed",
          time: new Date(),
        });
        await session.send(segment.at(session.userId!) + TIMEOUT_KICK_MSG);
        await session.onebot?.setGroupKick(session.channelId!, session.userId!); //TODO: use universal bot API here
        break;
      }

      if (!Number.isInteger(+userAnswer) || +userAnswer >= choices.length) {
        await session.send(
          segment.at(session.userId!) + WRONG_ANSWER_FORMAT_MSG,
        );
      } else {
        if (+userAnswer - 1 === answerIndex) {
          await ctx.database.set("quizLogs", logId, {
            status: "accepted",
            time: new Date(),
          });
          await session.send(segment.at(session.userId!) + CORRECT_ANSWER_MSG);
          break;
        } else {
          await ctx.database.set("quizLogs", logId, {
            status: "failed",
            time: new Date(),
          });
          await session.send(segment.at(session.userId!) + WRONG_ANSWER_MSG);
        }
      }

      if (retries >= channel.quizRetries) {
        await session.send(
          segment.at(session.userId!) + MAX_RETRIES_EXCEED_KICK_MSG,
        );
        await session.onebot?.setGroupKick(session.channelId!, session.userId!); //TODO: use universal bot API here
      }
    }
  });

  ctx.on("guild-deleted", async ({ channelId }) => {
    await ctx.database.remove("quizzes", { channelId });
  });
}
