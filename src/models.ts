import { Context } from "koishi";

declare module "koishi" {
  interface Tables {
    quizzes: Quizzes;
    quizLogs: QuizLogs;
  }
  interface Channel {
    welcomeMsg?: string;
    quizTimeout: number;
    quizRetries: number;
    rejoinDelay: number;
  }
}

export interface Quizzes {
  id: number;
  platform: string;
  channelId: string;
  question: string;
  wrongs: string[];
  correct: string;
  time: Date;
}

export interface QuizLogs {
  id: number;
  quizId: number;
  quizData: string[];
  quizAnswer: number;
  userId: string;
  status: "failed" | "accepted" | "waiting";
  time: Date;
}

export default function (ctx: Context) {
  ctx.model.extend(
    "quizzes",
    {
      id: "unsigned",
      channelId: "string",
      question: "string",
      wrongs: "list",
      correct: "string",
      time: "timestamp",
    },
    {
      autoInc: true,
      primary: "id",
      foreign: {
        channelId: ["channel", "id"],
        platform: ["channel", "platform"],
      },
    },
  );

  ctx.model.extend(
    "quizLogs",
    {
      id: "unsigned",
      quizId: "unsigned",
      quizData: "list",
      quizAnswer: "unsigned",
      userId: "string",
      status: "string",
      time: "timestamp",
    },
    {
      autoInc: true,
      primary: "id",
      foreign: {
        quizId: ["quizzes", "id"],
      },
    },
  );

  ctx.model.extend("channel", {
    welcomeMsg: { type: "string", initial: undefined },
    quizTimeout: { type: "unsigned", initial: 30 * 60 * 1000 },
    quizRetries: { type: "unsigned", initial: 3 },
    rejoinDelay: { type: "unsigned", initial: 10 * 60 * 1000 },
  });
}
