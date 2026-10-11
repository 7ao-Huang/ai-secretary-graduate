import { buildEmailDigest } from "@/lib/email-intelligence";
import { emailAccounts, emailInsights, tasks, type EmailInsight, type TaskItem } from "@/lib/mock-data";
import {
  alerts as defaultAlerts,
  dailySchedule as defaultDailySchedule,
  type DailyScheduleItem,
  type RescheduleAlert,
} from "@/lib/secretary-data";

export const HOME_DASHBOARD_STORAGE_KEY = "myflow-os-home-dashboard-v1";
export const TASK_CENTER_STORAGE_KEY = "myflow-os-task-center-v1";
export const EMAIL_CONNECTION_STORAGE_KEY = "myflow-os-email-connections-v1";
export const EMAIL_CONNECTIONS_UPDATED_EVENT = "myflow-os-email-connections-updated";

export type PersistedDashboardState = {
  selectedDate: string;
  viewedMonth: string;
  secretaryInsightMode?: "week" | "month";
  scheduleItems: DailyScheduleItem[];
  acceptedSuggestionIds: string[];
  alertItems: RescheduleAlert[];
};

export type TaskCenterItem = TaskItem & {
  id: string;
  reason: string;
  sourceType: "manual" | "email";
};

export type PersistedTaskCenterState = {
  tasks: TaskCenterItem[];
};

export type EmailConnectionProvider = "Gmail" | "Outlook" | "IMAP 自定义邮箱";

export type EmailConnectionAuthKind = "oauth" | "imap";

export type EmailConnectionAuthStatus =
  | "待配置"
  | "授权中"
  | "验证中"
  | "已授权"
  | "授权失败";

export type EmailConnectionItem = {
  id: string;
  provider: string;
  address: string;
  status: "待接入 OAuth" | "待配置 IMAP" | "连接中" | "已连接";
  sync: string;
  connected: boolean;
  lastSyncAt?: string;
  syncRunCount?: number;
  authKind?: EmailConnectionAuthKind;
  authStatus?: EmailConnectionAuthStatus;
  authAt?: string;
  authScopes?: string[];
  lastAuthMessage?: string;
  imapHost?: string;
  imapPort?: string;
  imapVerifyStatus?: "待验证" | "验证成功" | "验证失败";
  lastVerifyMessage?: string;
};

export type PersistedEmailConnectionState = {
  accounts: EmailConnectionItem[];
};

export type EmailSyncSummary = {
  accountId: string;
  provider: string;
  address: string;
  batchNumber: number;
  syncedEmails: number;
  newEmails: number;
  newTasks: number;
  triggersSchedule: boolean;
  lastSyncAt?: string;
};

export type EmailWorkspaceDigest = ReturnType<typeof buildEmailDigest>;

export type RecentEmailChangeTarget =
  | { kind: "task-center" }
  | { kind: "alert-section"; date?: string }
  | { kind: "day-flow"; date: string };

export type RecentEmailChange = {
  id: string;
  type: "task" | "reminder" | "schedule";
  title: string;
  detail: string;
  provider: string;
  syncedAt?: string;
  target: RecentEmailChangeTarget;
  actionLabel: string;
};

export function createStableId(prefix: string, value: string) {
  return `${prefix}-${encodeURIComponent(value).replace(/%/g, "").slice(0, 48)}`;
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function addMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  const nextHour = Math.floor(normalized / 60);
  const nextMinute = normalized % 60;
  return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
}

function resolveDeadline(deadline?: string) {
  const baseDate = new Date();
  const timeMatch = deadline?.match(/(\d{1,2}:\d{2})/);
  const start = timeMatch?.[1]?.padStart(5, "0") ?? "09:00";

  if (!deadline || deadline.includes("今天")) {
    return { date: formatDate(baseDate), start };
  }

  if (deadline.includes("明天")) {
    const next = new Date(baseDate);
    next.setDate(baseDate.getDate() + 1);
    return { date: formatDate(next), start };
  }

  if (deadline.includes("后天")) {
    const next = new Date(baseDate);
    next.setDate(baseDate.getDate() + 2);
    return { date: formatDate(next), start };
  }

  const exactDate = deadline.match(/(\d{4}-\d{2}-\d{2})/);
  if (exactDate) {
    return { date: exactDate[1], start };
  }

  const monthDay = deadline.match(/(\d{1,2})月(\d{1,2})日/);
  if (monthDay) {
    return {
      date: `${baseDate.getFullYear()}-${monthDay[1].padStart(2, "0")}-${monthDay[2].padStart(2, "0")}`,
      start,
    };
  }

  return { date: formatDate(baseDate), start };
}

function buildEmailScheduleItemsFromInsights(insights: EmailInsight[]) {
  const digest = buildEmailDigest(insights);

  return digest.insights
    .filter((insight) => insight.intent === "schedule")
    .map((insight) => {
      const { date, start } = resolveDeadline(insight.deadline);
      const title = insight.subject.includes("：")
        ? insight.subject.split("：").slice(-1)[0]
        : insight.subject;

      return {
        id: createStableId("email-schedule", insight.subject),
        date,
        title,
        category: "会议" as const,
        start,
        end: addMinutes(start, 60),
        priority: 1 as const,
        source: "邮件同步" as const,
        note: `${insight.summary} ${insight.action}`,
        showInMonth: true,
        status: "scheduled" as const,
        recurrence: "none" as const,
        isRecurring: false,
      };
    });
}

function buildEmailAlertsFromInsights(insights: EmailInsight[]) {
  const digest = buildEmailDigest(insights);
  const reminderAlerts = digest.reminders.map((reminder) => {
    const { date } = resolveDeadline(reminder.when);

    return {
      id: createStableId("email-reminder", `${reminder.title}-${reminder.when}`),
      title: reminder.title,
      detail: reminder.reason,
      date,
      impact: "这条提醒来自邮件同步，已经进入首页提醒流。",
    };
  });

  const scheduleAlerts = digest.scheduleImpacts.map((impact) => {
    const { date } = resolveDeadline(impact.when);

    return {
      id: createStableId("email-impact", `${impact.title}-${impact.when}`),
      title: `${impact.title} 已进入日程`,
      detail: impact.action,
      date,
      impact: impact.conflictPlan,
    };
  });

  return [...scheduleAlerts, ...reminderAlerts];
}

export function mergeEmailIntoDashboardState(params: {
  scheduleItems: DailyScheduleItem[];
  alertItems: RescheduleAlert[];
  accounts?: EmailConnectionItem[];
}) {
  const syncedInsights = getConnectedEmailInsights(params.accounts ?? []);
  const nextScheduleItems = params.scheduleItems.filter((item) => item.source !== "邮件同步");
  const nextAlerts = params.alertItems.filter(
    (alert) => !alert.id.startsWith("email-reminder-") && !alert.id.startsWith("email-impact-"),
  );

  buildEmailScheduleItemsFromInsights(syncedInsights).forEach((item) => {
    const index = nextScheduleItems.findIndex((current) => current.id === item.id);
    if (index >= 0) {
      nextScheduleItems[index] = item;
    } else {
      nextScheduleItems.unshift(item);
    }
  });

  buildEmailAlertsFromInsights(syncedInsights).forEach((alert) => {
    const index = nextAlerts.findIndex((current) => current.id === alert.id);
    if (index >= 0) {
      nextAlerts[index] = alert;
    } else {
      nextAlerts.unshift(alert);
    }
  });

  return {
    scheduleItems: nextScheduleItems,
    alertItems: nextAlerts.slice(0, 12),
  };
}

export type HomeDashboardIntent =
  | { mode: "month"; date: string }
  | { mode: "day"; date: string }
  | { mode: "alerts"; date: string };

export function resolveTaskDueTargetDate(task: Pick<TaskCenterItem, "due">) {
  return guessTargetDateFromText(task.due ?? "今天", formatDate(new Date()));
}

export function buildHomeDashboardHref(intent: HomeDashboardIntent) {
  const query = new URLSearchParams();
  query.set("date", intent.date);

  if (intent.mode === "day") {
    query.set("view", "day");
  }

  if (intent.mode === "alerts") {
    query.set("focus", "alerts");
  }

  return `/?${query.toString()}`;
}

export type TaskCenterIntent = {
  mode: "all" | "email-generated";
  focusTaskId?: string;
};

export function buildTaskCenterHref(intent: TaskCenterIntent = { mode: "all" }) {
  const query = new URLSearchParams();
  if (intent.mode === "email-generated") {
    query.set("focus", "email");
  }
  if (intent.focusTaskId) {
    query.set("taskId", intent.focusTaskId);
  }
  const search = query.toString();
  return search ? `/tasks?${search}` : "/tasks";
}

export function parseTaskCenterIntent(search: string | null | undefined): {
  focusEmailGenerated: boolean;
  focusTaskId?: string;
} {
  if (!search) {
    return { focusEmailGenerated: false };
  }

  const params = new URLSearchParams(search.replace(/^\?/, ""));
  return {
    focusEmailGenerated: params.get("focus") === "email",
    focusTaskId: params.get("taskId") ?? undefined,
  };
}

export function buildRecentEmailChangeHomeHref(change: RecentEmailChange): string {
  const params = new URLSearchParams();
  if (change.target.kind === "day-flow") {
    params.set("date", change.target.date);
    params.set("view", "day");
  } else if (change.target.kind === "alert-section") {
    params.set("date", change.target.date ?? change.syncedAt?.slice(0, 10) ?? "");
    params.set("focus", "alerts");
  }
  params.set("changeId", change.id);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function parseHomeDashboardIntent(
  search: string | null | undefined,
  fallback: { date: string },
): HomeDashboardIntent {
  if (!search) {
    return { mode: "month", date: fallback.date };
  }

  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "")
    ? (params.get("date") as string)
    : fallback.date;
  const view = params.get("view");
  const focus = params.get("focus");

  if (view === "day") {
    return { mode: "day", date };
  }

  if (focus === "alerts") {
    return { mode: "alerts", date };
  }

  return { mode: "month", date };
}

export function getDefaultTaskCenterTasks(): TaskCenterItem[] {
  return tasks.map((task, index) => ({
    ...task,
    id: `manual-task-${index + 1}`,
    reason:
      task.status === "待回复"
        ? "这类任务适合统一安排到邮件处理时段，减少上下文切换。"
        : task.priority === "高"
          ? "建议尽量锁定执行时间，避免被新的消息和零碎事项切断。"
          : "可在主线任务完成后再推进，不必抢占今天的最佳精力。",
    sourceType: "manual",
  }));
}

export function mergeEmailTasksIntoTaskCenter(
  currentTasks: TaskCenterItem[],
  accounts: EmailConnectionItem[] = [],
) {
  const digest = buildEmailDigest(getConnectedEmailInsights(accounts));
  const manualTasks = currentTasks.filter((task) => task.sourceType !== "email");
  const emailTasks = digest.generatedTasks.map((task) => ({
    id: createStableId("email-task", task.title),
    title: task.title,
    priority: task.priority,
    due: task.due,
    status: task.status,
    plan: task.source,
    reason: task.reason,
    sourceType: "email" as const,
  }));

  return [...emailTasks, ...manualTasks];
}

export function addManualTask(params: {
  title: string;
  priority?: "高" | "中" | "低";
  due?: string;
  reason?: string;
  plan?: string;
}): TaskCenterItem {
  const newTask: TaskCenterItem = {
    id: createStableId("manual-task", `${params.title}-${Date.now()}`),
    title: params.title,
    priority: params.priority ?? "中",
    due: params.due ?? "下周",
    status: "待开始",
    plan: params.plan ?? "来自周回顾",
    reason: params.reason ?? "从回顾页一键加入的调整动作",
    sourceType: "manual",
  };

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(TASK_CENTER_STORAGE_KEY);
      const existing: TaskCenterItem[] = raw
        ? (JSON.parse(raw) as PersistedTaskCenterState).tasks ?? []
        : getDefaultTaskCenterTasks();
      const next = [newTask, ...existing];
      window.localStorage.setItem(
        TASK_CENTER_STORAGE_KEY,
        JSON.stringify({ tasks: next }),
      );
    } catch {
    }
  }

  return newTask;
}

export function getDefaultEmailConnections(): EmailConnectionItem[] {
  return emailAccounts.map((account, index) => ({
    id: `email-account-${index + 1}`,
    provider: account.provider,
    address: account.address,
    status: account.status as EmailConnectionItem["status"],
    sync: account.sync,
    connected: false,
    syncRunCount: 0,
  }));
}

export function getPersistedEmailConnections(): EmailConnectionItem[] {
  if (typeof window === "undefined") {
    return getDefaultEmailConnections();
  }

  try {
    const raw = window.localStorage.getItem(EMAIL_CONNECTION_STORAGE_KEY);
    if (!raw) {
      return getDefaultEmailConnections();
    }

    const parsed = JSON.parse(raw) as Partial<PersistedEmailConnectionState>;
    return parsed.accounts?.length ? parsed.accounts : getDefaultEmailConnections();
  } catch {
    return getDefaultEmailConnections();
  }
}

export function notifyEmailConnectionsUpdated(accounts: EmailConnectionItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(EMAIL_CONNECTIONS_UPDATED_EVENT, {
      detail: { accounts },
    }),
  );
}

export function formatSyncTimestamp(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(
    2,
    "0",
  )} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function connectEmailAccount(
  accounts: EmailConnectionItem[],
  accountId: string,
  options?: { keepAuthStatus?: boolean },
): EmailConnectionItem[] {
  return accounts.map((account) =>
    account.id === accountId
      ? {
          ...account,
          connected: true,
          status: "已连接",
          lastSyncAt: undefined,
          syncRunCount: account.syncRunCount ?? 0,
          authKind:
            account.provider.includes("IMAP")
              ? "imap"
              : "oauth",
          authStatus:
            options?.keepAuthStatus && account.authStatus
              ? account.authStatus
              : account.provider.includes("IMAP")
                ? "待配置"
                : "待配置",
        }
      : account,
  );
}

export function startEmailOAuthFlow(
  accounts: EmailConnectionItem[],
  accountId: string,
): EmailConnectionItem[] {
  return accounts.map((account) =>
    account.id === accountId
      ? {
          ...account,
          authKind: "oauth",
          authStatus: "授权中",
          lastAuthMessage: "正在跳转到对应账号登录页面完成授权…",
        }
      : account,
  );
}

export function completeEmailOAuthFlow(
  accounts: EmailConnectionItem[],
  accountId: string,
  options: { scopes?: string[]; success?: boolean; message?: string } = {},
): EmailConnectionItem[] {
  const now = new Date();
  return accounts.map((account) => {
    if (account.id !== accountId) {
      return account;
    }

    const success = options.success !== false;
    return {
      ...account,
      authKind: "oauth",
      authStatus: success ? "已授权" : "授权失败",
      authAt: formatSyncTimestamp(now),
      authScopes:
        options.scopes && options.scopes.length > 0
          ? options.scopes
          : account.authScopes,
      lastAuthMessage: success
        ? options.message ?? "授权成功，已允许读取邮件、基础资料和发送能力范围。"
        : options.message ?? "授权未完成，可稍后重试或调整权限。",
    };
  });
}

export function updateEmailImapConfig(
  accounts: EmailConnectionItem[],
  accountId: string,
  config: { host?: string; port?: string },
): EmailConnectionItem[] {
  return accounts.map((account) =>
    account.id === accountId
      ? {
          ...account,
          authKind: "imap",
          imapHost: config.host ?? account.imapHost,
          imapPort: config.port ?? account.imapPort,
          imapVerifyStatus:
            account.imapVerifyStatus === "验证成功"
              ? account.imapVerifyStatus
              : "待验证",
        }
      : account,
  );
}

export function verifyImapEmailAccount(
  accounts: EmailConnectionItem[],
  accountId: string,
  options: { success?: boolean; message?: string } = {},
): EmailConnectionItem[] {
  return accounts.map((account) => {
    if (account.id !== accountId) {
      return account;
    }

    const success = options.success !== false;
    return {
      ...account,
      authKind: "imap",
      authStatus: success ? "已授权" : "授权失败",
      imapVerifyStatus: success ? "验证成功" : "验证失败",
      lastVerifyMessage: success
        ? options.message ?? "已通过 IMAP 验证，可开始同步该邮箱。"
        : options.message ?? "IMAP 验证失败，请检查服务器、端口或应用专用密码。",
    };
  });
}

export function isEmailAccountReadyForSync(account: EmailConnectionItem) {
  if (!account.connected) {
    return false;
  }

  if (account.authStatus === "已授权") {
    return true;
  }

  if (account.provider.includes("IMAP")) {
    return account.imapVerifyStatus === "验证成功";
  }

  return false;
}

export function disconnectEmailAccount(
  accounts: EmailConnectionItem[],
  accountId: string,
): EmailConnectionItem[] {
  return accounts.map((account) =>
    account.id === accountId
      ? {
          ...account,
          connected: false,
          status: account.provider.includes("IMAP") ? "待配置 IMAP" : "待接入 OAuth",
          lastSyncAt: undefined,
          syncRunCount: 0,
          authStatus: "待配置",
          authAt: undefined,
          authScopes: undefined,
          lastAuthMessage: undefined,
          imapHost: undefined,
          imapPort: undefined,
          imapVerifyStatus: undefined,
          lastVerifyMessage: undefined,
        }
      : account,
  );
}

export function markEmailAccountSync(
  accounts: EmailConnectionItem[],
  accountId: string,
): EmailConnectionItem[] {
  const now = new Date();
  return accounts.map((account) =>
    account.id === accountId && account.connected && isEmailAccountReadyForSync(account)
      ? {
          ...account,
          lastSyncAt: formatSyncTimestamp(now),
          syncRunCount: (account.syncRunCount ?? 0) + 1,
        }
      : account,
  );
}

function getMailboxAliases(account: EmailConnectionItem) {
  if (account.provider === "Gmail") {
    return ["Gmail"];
  }

  if (account.provider === "Outlook") {
    return ["Outlook"];
  }

  if (account.provider.includes("IMAP")) {
    return ["IMAP 自定义邮箱", "自定义邮箱", "学校邮箱"];
  }

  return [account.provider];
}

function doesInsightBelongToAccount(insight: EmailInsight, account: EmailConnectionItem) {
  const mailbox = insight.mailbox ?? "";
  return getMailboxAliases(account).includes(mailbox);
}

function getVisibleInsightsForAccount(account: EmailConnectionItem) {
  if (!account.connected) {
    return [];
  }

  const matchedInsights = emailInsights.filter((insight) => doesInsightBelongToAccount(insight, account));
  const syncRunCount = account.syncRunCount ?? 0;

  if (syncRunCount <= 0) {
    return [];
  }

  return matchedInsights.slice(0, Math.min(syncRunCount, matchedInsights.length));
}

function getLatestBatchInsightsForAccount(account: EmailConnectionItem) {
  const matchedInsights = emailInsights.filter((insight) => doesInsightBelongToAccount(insight, account));
  const syncRunCount = account.syncRunCount ?? 0;

  if (!account.connected || syncRunCount <= 0) {
    return [];
  }

  const latestIndex = Math.min(syncRunCount, matchedInsights.length) - 1;
  return latestIndex >= 0 && matchedInsights[latestIndex] ? [matchedInsights[latestIndex]] : [];
}

export function getConnectedEmailInsights(accounts: EmailConnectionItem[]) {
  return accounts.flatMap((account) => getVisibleInsightsForAccount(account));
}

export function buildWorkspaceEmailDigest(accounts: EmailConnectionItem[]): EmailWorkspaceDigest {
  return buildEmailDigest(getConnectedEmailInsights(accounts));
}

export function getLatestEmailSyncLabel(accounts: EmailConnectionItem[]) {
  const latestAccount = accounts
    .filter((account) => account.connected && account.lastSyncAt)
    .sort((left, right) => (left.lastSyncAt ?? "").localeCompare(right.lastSyncAt ?? ""))
    .at(-1);

  return latestAccount?.lastSyncAt ?? "尚未执行模拟同步";
}

export function buildEmailSyncSummaries(accounts: EmailConnectionItem[]): EmailSyncSummary[] {
  return accounts
    .filter((account) => account.connected)
    .map((account) => {
      const visibleInsights = getVisibleInsightsForAccount(account);
      const latestBatchInsights = getLatestBatchInsightsForAccount(account);
      const latestBatchDigest = buildEmailDigest(latestBatchInsights);

      return {
        accountId: account.id,
        provider: account.provider,
        address: account.address,
        batchNumber: account.syncRunCount ?? 0,
        syncedEmails: visibleInsights.length,
        newEmails: latestBatchInsights.length,
        newTasks: latestBatchDigest.generatedTasks.length,
        triggersSchedule: latestBatchDigest.scheduleImpacts.length > 0,
        lastSyncAt: account.lastSyncAt,
      };
    });
}

function guessTargetDateFromText(text: string, fallbackDate: string) {
  if (!text) return fallbackDate;

  const absoluteDate = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (absoluteDate) {
    return `${absoluteDate[1]}-${absoluteDate[2].padStart(2, "0")}-${absoluteDate[3].padStart(2, "0")}`;
  }

  const today = new Date(fallbackDate);
  const todayKeywordMatch = text.match(/今天|今晚|稍后/);
  if (todayKeywordMatch) return formatDate(today);

  const tomorrowKeywordMatch = text.match(/明天/);
  if (tomorrowKeywordMatch) {
    const next = new Date(today);
    next.setDate(next.getDate() + 1);
    return formatDate(next);
  }

  const weekdayMatch = text.match(/(本|下)?周([一二三四五六日天])/);
  if (weekdayMatch) {
    const weekdayMap: Record<string, number> = {
      一: 1,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      日: 0,
      天: 0,
    };
    const targetWeekday = weekdayMap[weekdayMatch[2] ?? ""];
    if (typeof targetWeekday === "number") {
      const base = new Date(today);
      const currentWeekday = base.getDay();
      let diff = targetWeekday - currentWeekday;
      if (diff <= 0) diff += 7;
      if (weekdayMatch[1] === "下") diff += 7;
      base.setDate(base.getDate() + diff);
      return formatDate(base);
    }
  }

  return fallbackDate;
}

export function buildRecentEmailChanges(accounts: EmailConnectionItem[]): RecentEmailChange[] {
  return accounts
    .filter((account) => account.connected && (account.syncRunCount ?? 0) > 0)
    .flatMap((account) => {
      const today = formatDate(new Date());
      const latestBatchInsights = getLatestBatchInsightsForAccount(account);
      const latestBatchDigest = buildEmailDigest(latestBatchInsights);
      const syncedAt = account.lastSyncAt;

      const taskChanges = latestBatchDigest.generatedTasks.map((task) => ({
        id: `task-${account.id}-${task.title}`,
        type: "task" as const,
        title: task.title,
        detail: `已进入任务中心，截止 ${task.due}`,
        provider: account.provider,
        syncedAt,
        target: { kind: "task-center" as const },
        actionLabel: "去任务中心处理",
      }));

      const reminderChanges = latestBatchDigest.reminders.map((reminder) => {
        const dateText = `${reminder.when} ${reminder.reason}`;
        return {
          id: `reminder-${account.id}-${reminder.title}-${reminder.when}`,
          type: "reminder" as const,
          title: reminder.title,
          detail: `提醒时间 ${reminder.when}，${reminder.reason}`,
          provider: account.provider,
          syncedAt,
          target: { kind: "alert-section" as const, date: guessTargetDateFromText(dateText, today) },
          actionLabel: "定位到提醒区",
        };
      });

      const scheduleChanges = latestBatchDigest.scheduleImpacts.map((impact) => {
        const dateText = `${impact.when} ${impact.conflictPlan}`;
        return {
          id: `schedule-${account.id}-${impact.title}-${impact.when}`,
          type: "schedule" as const,
          title: impact.title,
          detail: `已准备写入首页日程，${impact.conflictPlan}`,
          provider: account.provider,
          syncedAt,
          target: { kind: "day-flow" as const, date: guessTargetDateFromText(dateText, today) },
          actionLabel: "查看对应日期",
        };
      });

      return [...scheduleChanges, ...taskChanges, ...reminderChanges];
    })
    .sort((left, right) => (right.syncedAt ?? "").localeCompare(left.syncedAt ?? ""))
    .slice(0, 6);
}

const DEMO_REFERENCE_DATE = "2026-08-12";

function offsetDateFromReference(date: string, referenceDate: string, todayDate: string) {
  const base = new Date(`${date}T00:00:00`);
  const ref = new Date(`${referenceDate}T00:00:00`);
  const diffDays = Math.round((base.getTime() - ref.getTime()) / 86400000);
  const target = new Date(`${todayDate}T00:00:00`);
  target.setDate(target.getDate() + diffDays);
  return formatDate(target);
}

function shiftScheduleItemsToToday(items: DailyScheduleItem[], todayDate: string): DailyScheduleItem[] {
  return items.map((item) => {
    const nextDate = offsetDateFromReference(item.date, DEMO_REFERENCE_DATE, todayDate);
    const next: DailyScheduleItem = { ...item, date: nextDate };
    if (item.rescheduledFrom) {
      next.rescheduledFrom = {
        ...item.rescheduledFrom,
        date: offsetDateFromReference(item.rescheduledFrom.date, DEMO_REFERENCE_DATE, todayDate),
      };
    }
    if (item.recurrenceEndsOn) {
      next.recurrenceEndsOn = offsetDateFromReference(
        item.recurrenceEndsOn,
        DEMO_REFERENCE_DATE,
        todayDate,
      );
    }
    return next;
  });
}

function shiftAlertsToToday(items: RescheduleAlert[], todayDate: string): RescheduleAlert[] {
  return items.map((item) => ({
    ...item,
    date: offsetDateFromReference(item.date, DEMO_REFERENCE_DATE, todayDate),
  }));
}

export function seedDemoDataIfEmpty(todayDate: string) {
  if (typeof window === "undefined") {
    return;
  }

  const hasEmailConnections = Boolean(window.localStorage.getItem(EMAIL_CONNECTION_STORAGE_KEY));
  const hasDashboard = Boolean(window.localStorage.getItem(HOME_DASHBOARD_STORAGE_KEY));

  if (!hasEmailConnections) {
    const demoAccount: EmailConnectionItem = {
      id: "email-account-1",
      provider: "Gmail",
      address: "me.work@gmail.com",
      status: "已连接",
      sync: "计划每 30 分钟同步",
      connected: true,
      syncRunCount: 1,
      lastSyncAt: formatSyncTimestamp(new Date()),
      authKind: "oauth",
      authStatus: "已授权",
      authAt: formatSyncTimestamp(new Date(Date.now() - 1000 * 60 * 60 * 24 * 2)),
      authScopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    };
    const otherAccounts = emailAccounts.slice(1).map((account, index) => ({
      id: `email-account-${index + 2}`,
      provider: account.provider,
      address: account.address,
      status: account.status as EmailConnectionItem["status"],
      sync: account.sync,
      connected: false,
      syncRunCount: 0,
    }));
    window.localStorage.setItem(
      EMAIL_CONNECTION_STORAGE_KEY,
      JSON.stringify({ accounts: [demoAccount, ...otherAccounts] }),
    );
  }

  if (!hasDashboard) {
    const scheduleItems = shiftScheduleItemsToToday(defaultDailySchedule, todayDate);
    const alertItems = shiftAlertsToToday(defaultAlerts, todayDate);
    window.localStorage.setItem(
      HOME_DASHBOARD_STORAGE_KEY,
      JSON.stringify({
        selectedDate: todayDate,
        viewedMonth: `${todayDate.slice(0, 7)}-01`,
        secretaryInsightMode: "week",
        scheduleItems,
        acceptedSuggestionIds: [],
        alertItems,
      }),
    );
  }
}
