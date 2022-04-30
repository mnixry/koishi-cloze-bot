export const DEFAULT_WELCOME_MSG = "欢迎加入群聊!" as const;

export const COMPLETE_QUIZ_HINT_MSG =
  "请回复选项前序号来回答下列问题:\n" as const;

export const WRONG_ANSWER_MSG = "对不起, 您输入的答案错误" as const;

export const WRONG_ANSWER_FORMAT_MSG =
  "对不起, 您输入的答案格式错误, 可能是您还未完成入群验证问题" as const;

export const CORRECT_ANSWER_MSG =
  "验证问题正确, 入群验证已通过, 感谢支持" as const;

export const TIMEOUT_KICK_MSG =
  "您的回答超时, 入群验证失败, 请重新入群" as const;

export const MAX_RETRIES_EXCEED_KICK_MSG =
  "您的回答次数超过限制, 入群验证失败, 请重新入群" as const;

export const IN_JOIN_DELAY_KICK_MSG =
  "您的入群时间间隔过短, 请稍后再试" as const;
