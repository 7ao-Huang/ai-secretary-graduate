import { emailInsights, type EmailInsight } from "@/lib/mock-data";

export type EmailActionTask = {
  title: string;
  due: string;
  priority: "高" | "中" | "低";
  status: "待回复" | "待开始";
  destination: "任务中心";
  reason: string;
  source: "邮件智能中心";
};

export type EmailReminder = {
  title: string;
  when: string;
  tone: "danger" | "medium" | "low";
  reason: string;
};

export type EmailScheduleImpact = {
  title: string;
  when: string;
  source: string;
  action: string;
  conflictPlan: string;
};

export type EmailArchiveDecision = {
  subject: string;
  mailbox: string;
  reason: string;
};

export type EmailDigestResult = {
  generatedAt: string;
  overview: {
    totalNewEmails: number;
    important: number;
    todo: number;
    ignored: number;
    needsReplyBefore: string;
  };
  insights: EmailInsight[];
  generatedTasks: EmailActionTask[];
  reminders: EmailReminder[];
  scheduleImpacts: EmailScheduleImpact[];
  archiveDecisions: EmailArchiveDecision[];
  nextStep: string;
};

function findReminderTone(level: EmailInsight["level"]): "danger" | "medium" | "low" {
  if (level === "立即处理") {
    return "danger";
  }

  if (level === "今天处理") {
    return "medium";
  }

  return "low";
}

function createTaskFromInsight(insight: EmailInsight): EmailActionTask | null {
  const due = insight.deadline ?? (insight.level === "立即处理" ? "今天" : "本周");

  if (insight.intent === "reply") {
    return {
      title: `回复：${insight.subject}`,
      due,
      priority: "高",
      status: "待回复",
      destination: "任务中心",
      reason: "邮件存在明确回复要求和截止时间，适合直接进入待回复任务。",
      source: "邮件智能中心",
    };
  }

  if (insight.intent === "todo") {
    return {
      title: "处理自动扣款失败并补缴账单",
      due,
      priority: "中",
      status: "待开始",
      destination: "任务中心",
      reason: "这类事务型邮件不一定要回信，但必须被落实成可执行动作。",
      source: "邮件智能中心",
    };
  }

  if (insight.intent === "schedule") {
    return {
      title: "准备明天项目评审会议材料",
      due,
      priority: "高",
      status: "待开始",
      destination: "任务中心",
      reason: "涉及固定会议的邮件除了写入日程，也应该同步生成会前准备任务。",
      source: "邮件智能中心",
    };
  }

  return null;
}

function createReminderFromInsight(insight: EmailInsight): EmailReminder | null {
  if (insight.intent === "ignore") {
    return null;
  }

  return {
    title:
      insight.intent === "schedule"
        ? "会议前提醒与材料检查"
        : insight.intent === "reply"
          ? "待回复邮件提醒"
          : "事务处理提醒",
    when: insight.deadline ?? "今天稍后",
    tone: findReminderTone(insight.level),
    reason: insight.action,
  };
}

function createScheduleImpactFromInsight(insight: EmailInsight): EmailScheduleImpact | null {
  if (!insight.triggersSchedule) {
    return null;
  }

  return {
    title: "项目评审会议",
    when: insight.deadline ?? "待定",
    source: insight.sender,
    action: "写入首页月历，并作为强约束事项参与冲突检测。",
    conflictPlan: "如果与健身、学习块或其它可移动安排冲突，则自动把低优先级项后移到最近空档。",
  };
}

function createArchiveDecisionFromInsight(insight: EmailInsight): EmailArchiveDecision | null {
  if (insight.intent !== "ignore") {
    return null;
  }

  return {
    subject: insight.subject,
    mailbox: insight.mailbox ?? "未指定邮箱",
    reason: "促销类邮件没有明确动作要求，默认不进入提醒流。",
  };
}

export function buildEmailDigest(insights: EmailInsight[] = emailInsights): EmailDigestResult {
  const generatedTasks = insights
    .map((insight) => createTaskFromInsight(insight))
    .filter((task): task is EmailActionTask => task !== null);

  const reminders = insights
    .map((insight) => createReminderFromInsight(insight))
    .filter((reminder): reminder is EmailReminder => reminder !== null);

  const scheduleImpacts = insights
    .map((insight) => createScheduleImpactFromInsight(insight))
    .filter((impact): impact is EmailScheduleImpact => impact !== null);

  const archiveDecisions = insights
    .map((insight) => createArchiveDecisionFromInsight(insight))
    .filter((decision): decision is EmailArchiveDecision => decision !== null);

  const important = insights.filter((insight) => insight.level === "立即处理").length;
  const todo = insights.filter((insight) => insight.level === "今天处理").length;
  const ignored = insights.filter((insight) => insight.level === "可忽略").length;
  const nextReplyDeadline =
    insights.find((insight) => insight.intent === "reply")?.deadline ?? "今天 18:00";

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      totalNewEmails: insights.length,
      important,
      todo,
      ignored,
      needsReplyBefore: nextReplyDeadline,
    },
    insights,
    generatedTasks,
    reminders,
    scheduleImpacts,
    archiveDecisions,
    nextStep: "下一步可把这里替换为 Gmail / Outlook / IMAP 的真实拉取结果，并继续复用这层分流逻辑。",
  };
}
