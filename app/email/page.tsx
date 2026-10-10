"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge, SectionCard } from "@/components/section-card";
import { buildEmailDigest } from "@/lib/email-intelligence";
import { emailWorkflow } from "@/lib/mock-data";
import {
  EMAIL_CONNECTION_STORAGE_KEY,
  buildEmailSyncSummaries,
  completeEmailOAuthFlow,
  connectEmailAccount,
  disconnectEmailAccount,
  getDefaultEmailConnections,
  getConnectedEmailInsights,
  getLatestEmailSyncLabel,
  isEmailAccountReadyForSync,
  markEmailAccountSync,
  notifyEmailConnectionsUpdated,
  startEmailOAuthFlow,
  updateEmailImapConfig,
  verifyImapEmailAccount,
  type EmailConnectionItem,
  type EmailConnectionAuthStatus,
  type PersistedEmailConnectionState,
} from "@/lib/workspace-sync";

type ConnectionDraft = {
  mode: "oauth" | "imap";
  accountId: string;
  provider: string;
  email: string;
  host: string;
  port: string;
  password: string;
  permissions: string[];
  step:
    | "intro"
    | "permissions"
    | "confirm"
    | "oauth-inflight"
    | "oauth-result"
    | "imap-config"
    | "imap-verify-inflight"
    | "imap-result";
  oauthResultStatus?: EmailConnectionAuthStatus;
  oauthResultMessage?: string;
  imapVerifyStatus?: "验证中" | "验证成功" | "验证失败";
  imapVerifyMessage?: string;
};

export default function EmailPage() {
  const [accounts, setAccounts] = useState<EmailConnectionItem[]>(getDefaultEmailConnections());
  const [isHydrated, setIsHydrated] = useState(false);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null);
  const [connectionError, setConnectionError] = useState("");

  useEffect(() => {
    let nextAccounts = getDefaultEmailConnections();

    try {
      const raw = window.localStorage.getItem(EMAIL_CONNECTION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedEmailConnectionState>;
        nextAccounts = parsed.accounts?.length ? parsed.accounts : nextAccounts;
      }
    } catch {
    }

    queueMicrotask(() => {
      setAccounts(nextAccounts);
      setIsHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(
      EMAIL_CONNECTION_STORAGE_KEY,
      JSON.stringify({ accounts }),
    );
    notifyEmailConnectionsUpdated(accounts);
  }, [accounts, isHydrated]);

  const connectedCount = useMemo(
    () => accounts.filter((account) => account.connected).length,
    [accounts],
  );
  const syncedAccountCount = useMemo(
    () => accounts.filter((account) => account.connected && (account.syncRunCount ?? 0) > 0).length,
    [accounts],
  );
  const pendingCount = accounts.length - connectedCount;
  const connectedInsights = useMemo(() => getConnectedEmailInsights(accounts), [accounts]);
  const digest = useMemo(() => buildEmailDigest(connectedInsights), [connectedInsights]);
  const {
    insights,
    overview,
    generatedTasks,
    reminders,
    scheduleImpacts,
    archiveDecisions,
  } = digest;
  const lastSyncLabel = useMemo(
    () => getLatestEmailSyncLabel(accounts),
    [accounts],
  );
  const syncSummaries = useMemo(() => buildEmailSyncSummaries(accounts), [accounts]);

  const mailboxHealth = [
    {
      label: "需立即处理",
      value: `${overview.important} 封`,
      hint:
        syncedAccountCount > 0
          ? "这些已连接邮箱里的邮件已经具备明确外部约束，更适合被转成任务与提醒。"
          : connectedCount > 0
            ? "邮箱已经连接，但还需要先执行同步，系统才会开始计算真正需要你立即处理的邮件。"
            : "先连接邮箱，系统才会开始计算真正需要你立即处理的邮件。",
    },
    {
      label: "今日统一处理",
      value: `${overview.todo} 封`,
      hint:
        syncedAccountCount > 0
          ? "适合被压进固定邮件时段，而不是不断插入今天的主线任务。"
          : connectedCount > 0
            ? "完成首次同步后，这里会只展示今天适合集中处理的邮件。"
            : "连接邮箱后，这里会只展示今天适合集中处理的邮件。",
    },
    {
      label: "可自动忽略",
      value: `${overview.ignored} 封`,
      hint:
        syncedAccountCount > 0
          ? "广告、促销、泛通知不应该继续占用你的注意力。"
          : connectedCount > 0
            ? "执行同步后，系统会自动把广告和营销信息从主视线里移走。"
            : "系统会在邮箱接入后自动把广告和营销信息从主视线里移走。",
    },
  ];
  const connectionMetrics = [
    {
      label: "已连接邮箱",
      value: `${connectedCount} 个`,
      hint: "完成连接后，后面就能直接替换成本地模拟同步结果。",
    },
    {
      label: "待接入邮箱",
      value: `${pendingCount} 个`,
      hint: "Gmail / Outlook 走 OAuth，自定义邮箱后续接 IMAP 配置。",
    },
    {
      label: "最近同步",
      value: lastSyncLabel,
      hint: "这一步现在先做本地模拟，后面再替换成真实拉取时间与后台拉取任务。",
    },
  ];

  const triagePanels = [
    {
      title: "需要回复",
      description: "优先识别有明确提问、截止时间、合作上下文和风险后果的邮件。",
      examples: "合作确认、导师邮件、账单失败、面试安排",
      tone: "danger" as const,
    },
    {
      title: "需要行动",
      description: "不一定要回信，但需要你付款、填写、确认、上传、阅读附件或加入日程。",
      examples: "账单缴费、材料提交、表单确认、活动 RSVP",
      tone: "medium" as const,
    },
    {
      title: "可以归档",
      description: "默认不提醒，只在需要时通过搜索或归档箱再回看。",
      examples: "促销活动、系统广播、重复订阅、营销邮件",
      tone: "success" as const,
    },
  ];

  const landingSteps = [
    "先接 Gmail / Outlook / IMAP 授权，把现在的假数据入口替换为真实邮箱连接状态。",
    "在接口层补上真实拉取与基础分类，再把需要回复和需要行动的邮件推给任务页。",
    "最后把涉及时间冲突的邮件转进首页日程，让邮件真正参与自动排程。",
  ];
  const oauthPermissions = [
    "读取收件箱摘要与发件人信息",
    "识别截止时间、动作词和会议时间",
    "把需要处理的邮件转成任务与提醒",
  ];

  function openConnectionFlow(account: EmailConnectionItem) {
    setConnectionError("");
    setConnectionDraft({
      mode: account.provider.includes("IMAP") ? "imap" : "oauth",
      accountId: account.id,
      provider: account.provider,
      email: account.address,
      host: account.provider.includes("IMAP") ? "imap.mydomain.com" : "",
      port: account.provider.includes("IMAP") ? "993" : "",
      password: "",
      permissions: oauthPermissions,
      step: "intro",
    });
  }

  function handleDisconnect(accountId: string) {
    setAccounts((current) => disconnectEmailAccount(current, accountId));
  }

  function handleSync(accountId: string) {
    const account = accounts.find((item) => item.id === accountId);
    if (!account) {
      return;
    }
    if (!isEmailAccountReadyForSync(account)) {
      setConnectionError(
        account.authKind === "imap"
          ? "该邮箱还未通过 IMAP 验证，请先完成验证再同步。"
          : "该邮箱还未完成授权，请先完成 OAuth 授权再同步。",
      );
      return;
    }
    setAccounts((current) => markEmailAccountSync(current, accountId));
  }

  function closeConnectionFlow() {
    setConnectionDraft(null);
    setConnectionError("");
  }

  function handleDraftChange(field: "email" | "host" | "port" | "password", value: string) {
    setConnectionError("");
    setConnectionDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function handleAdvanceConnectionStep() {
    if (!connectionDraft) {
      return;
    }

    if (connectionDraft.mode === "oauth") {
      if (connectionDraft.step === "intro") {
        setConnectionDraft((current) => (current ? { ...current, step: "permissions" } : current));
        return;
      }
      if (connectionDraft.step === "permissions") {
        setConnectionDraft((current) => (current ? { ...current, step: "confirm" } : current));
        return;
      }
      if (connectionDraft.step === "confirm") {
        setAccounts((current) =>
          startEmailOAuthFlow(
            current.map((account) =>
              account.id === connectionDraft.accountId
                ? {
                    ...account,
                    address: connectionDraft.email.trim() || account.address,
                  }
                : account,
            ),
            connectionDraft.accountId,
          ),
        );
        setConnectionDraft((current) => (current ? { ...current, step: "oauth-inflight" } : current));
        return;
      }
      return;
    }

    if (connectionDraft.step === "intro") {
      if (
        !connectionDraft.email.trim() ||
        !connectionDraft.host.trim() ||
        !connectionDraft.port.trim()
      ) {
        setConnectionError("请先补全邮箱地址、IMAP 服务器和端口。");
        return;
      }
      if (!connectionDraft.password.trim()) {
        setConnectionError("请填写应用专用密码或授权码。");
        return;
      }
      setAccounts((current) =>
        updateEmailImapConfig(
          current.map((account) =>
            account.id === connectionDraft.accountId
              ? {
                  ...account,
                  address: connectionDraft.email.trim() || account.address,
                }
              : account,
          ),
          connectionDraft.accountId,
          {
            host: connectionDraft.host.trim(),
            port: connectionDraft.port.trim(),
          },
        ),
      );
      setConnectionDraft((current) => (current ? { ...current, step: "imap-config" } : current));
      return;
    }
  }

  function handleSimulateOAuth(success: boolean) {
    if (!connectionDraft || connectionDraft.mode !== "oauth") {
      return;
    }
    const message = success
      ? "授权成功，已允许读取邮件、基础资料和发送能力范围。"
      : "用户取消授权或权限不足，请稍后重试。";
    setAccounts((current) =>
      completeEmailOAuthFlow(current, connectionDraft.accountId, {
        success,
        scopes: success ? connectionDraft.permissions : [],
        message,
      }),
    );
    setConnectionDraft((current) =>
      current
        ? {
            ...current,
            step: "oauth-result",
            oauthResultStatus: success ? "已授权" : "授权失败",
            oauthResultMessage: message,
          }
        : current,
    );
  }

  function handleVerifyImap(success: boolean) {
    if (!connectionDraft || connectionDraft.mode !== "imap") {
      return;
    }
    setConnectionDraft((current) =>
      current
        ? {
            ...current,
            step: "imap-verify-inflight",
            imapVerifyStatus: "验证中",
            imapVerifyMessage: "正在与 IMAP 服务器握手并测试登录…",
          }
        : current,
    );
    const message = success
      ? "已通过 IMAP 验证，可开始同步该邮箱。"
      : "IMAP 验证失败，请检查服务器、端口或应用专用密码。";
    window.setTimeout(() => {
      setAccounts((current) =>
        verifyImapEmailAccount(current, connectionDraft.accountId, {
          success,
          message,
        }),
      );
      setConnectionDraft((current) =>
        current
          ? {
              ...current,
              step: "imap-result",
              imapVerifyStatus: success ? "验证成功" : "验证失败",
              imapVerifyMessage: message,
            }
          : current,
      );
    }, 700);
  }

  function handleCompleteConnection() {
    if (!connectionDraft) {
      return;
    }

    if (connectionDraft.mode === "oauth") {
      if (connectionDraft.oauthResultStatus !== "已授权") {
        setConnectionError("还未完成 OAuth 授权，请先完成授权再连接。");
        return;
      }
    }

    if (connectionDraft.mode === "imap") {
      if (connectionDraft.imapVerifyStatus !== "验证成功") {
        setConnectionError("还未通过 IMAP 验证，请先完成验证再连接。");
        return;
      }
    }

    setAccounts((current) =>
      connectEmailAccount(current, connectionDraft.accountId, { keepAuthStatus: true }),
    );
    closeConnectionFlow();
  }

  return (
    <AppShell
      title="邮件智能中心"
      description="这里负责把多个邮箱里的消息先做减法，再把真正重要的邮件转成提醒、任务和可能影响日程的动作。"
      highlight={{
        label: "当前目标",
        value: "把邮件从信息流变成执行流",
        hint: "广告、促销和无动作要求的邮件自动退出主视线，真正需要处理的邮件才进入任务、提醒和排程。",
      }}
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          {mailboxHealth.map((item) => (
            <div
              key={item.label}
              className="rounded-[1.8rem] border border-white/75 bg-white/78 p-5 shadow-[0_16px_38px_rgba(148,163,184,0.12)] backdrop-blur-xl"
            >
              <div className="text-sm font-medium text-slate-500">{item.label}</div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
                {item.value}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.hint}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {connectionMetrics.map((item) => (
            <div
              key={item.label}
              className="rounded-[1.8rem] border border-white/75 bg-white/78 p-5 shadow-[0_16px_38px_rgba(148,163,184,0.12)] backdrop-blur-xl"
            >
              <div className="text-sm font-medium text-slate-500">{item.label}</div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
                {item.value}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.hint}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <div className="space-y-6">
            <SectionCard
              title="接入控制台"
              description="这部分已经不只是入口骨架。只有已连接邮箱才会驱动下面的邮件摘要、任务和提醒结果。"
            >
              <div className="space-y-3">
                {accounts.map((account) => {
                  const readyForSync = isEmailAccountReadyForSync(account);
                  const isImap = account.provider.includes("IMAP");
                  const syncDisabledReason = !account.connected
                    ? "尚未连接"
                    : !readyForSync
                      ? isImap
                        ? account.imapVerifyStatus !== "验证成功"
                          ? "先完成 IMAP 验证"
                          : "先完成授权"
                        : account.authStatus !== "已授权"
                          ? "先完成授权"
                          : "授权状态未就绪"
                      : "";
                  return (
                    <div
                      key={account.id}
                      className="rounded-[1.7rem] border border-slate-100 bg-slate-50 p-5"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-medium text-slate-900">
                              {account.provider}
                            </p>
                            <Badge tone={account.connected ? "success" : "medium"}>
                              {account.status}
                            </Badge>
                            {account.authStatus ? (
                              <Badge
                                tone={
                                  account.authStatus === "已授权"
                                    ? "success"
                                    : account.authStatus === "授权失败"
                                      ? "danger"
                                      : account.authStatus === "授权中" ||
                                          account.authStatus === "验证中"
                                        ? "medium"
                                        : "default"
                                }
                              >
                                {account.authKind === "imap" && account.authStatus === "待配置"
                                  ? "IMAP 待配置"
                                  : account.authStatus}
                              </Badge>
                            ) : null}
                            {isImap && account.imapVerifyStatus ? (
                              <Badge
                                tone={
                                  account.imapVerifyStatus === "验证成功"
                                    ? "success"
                                    : account.imapVerifyStatus === "验证失败"
                                      ? "danger"
                                      : "medium"
                                }
                              >
                                验证：{account.imapVerifyStatus}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-slate-500">{account.address}</p>
                          {isImap && account.imapHost ? (
                            <p className="mt-1 text-sm text-slate-500">
                              IMAP：{account.imapHost}:{account.imapPort ?? "—"}
                            </p>
                          ) : null}
                          {account.authAt ? (
                            <p className="mt-1 text-sm text-slate-500">
                              最近授权：{account.authAt}
                            </p>
                          ) : null}
                          {account.lastAuthMessage ? (
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {account.lastAuthMessage}
                            </p>
                          ) : (
                            <p className="mt-3 text-sm leading-6 text-slate-600">{account.sync}</p>
                          )}
                          {isImap && account.lastVerifyMessage ? (
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              验证详情：{account.lastVerifyMessage}
                            </p>
                          ) : null}
                          <p className="mt-2 text-sm text-slate-500">
                            最近同步：{account.lastSyncAt ?? "尚未同步"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            同步批次：第 {account.syncRunCount ?? 0} 次
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {account.connected ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSync(account.id)}
                                disabled={!readyForSync}
                                title={syncDisabledReason}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:text-slate-700"
                              >
                                立即同步
                                {syncDisabledReason ? `（${syncDisabledReason}）` : ""}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDisconnect(account.id)}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-rose-200 hover:text-rose-700"
                              >
                                断开连接
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openConnectionFlow(account)}
                              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                            >
                              {account.provider.includes("IMAP") ? "开始配置" : "连接邮箱"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard
              title="同步结果"
              description="每个已连接邮箱都会有自己的同步结果，后面接真实接口时可以直接复用这层展示。"
            >
              <div className="space-y-3">
                {syncSummaries.length > 0 ? (
                  syncSummaries.map((summary) => (
                    <div
                      key={summary.accountId}
                      className="rounded-[1.7rem] border border-slate-100 bg-slate-50 p-5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-medium text-slate-900">{summary.provider}</p>
                        <Badge tone={summary.batchNumber > 0 ? "success" : "medium"}>
                          {summary.batchNumber > 0 ? `第 ${summary.batchNumber} 次同步` : "等待首次同步"}
                        </Badge>
                        <span className="text-sm text-slate-500">{summary.address}</span>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl bg-white p-4">
                          <div className="text-sm text-slate-500">累计纳入邮件</div>
                          <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                            {summary.syncedEmails}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <div className="text-sm text-slate-500">本次新增邮件</div>
                          <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                            {summary.newEmails}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <div className="text-sm text-slate-500">本次新任务</div>
                          <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                            {summary.newTasks}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <div className="text-sm text-slate-500">触发日程</div>
                          <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                            {summary.triggersSchedule ? "是" : "否"}
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-500">
                        最近同步：{summary.lastSyncAt ?? "尚未同步"}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                    还没有已连接邮箱。先完成 Gmail、Outlook 或 IMAP 接入，下面的邮件结果才会开始出现。
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="邮件分流结果"
              description="这一块不只是展示邮件，而是直接说明系统看完邮件后会怎么替你做初步判断。"
            >
              <div className="space-y-4">
                {insights.length > 0 ? (
                  insights.map((item) => (
                    <article
                      key={item.subject}
                      className="rounded-[1.7rem] border border-slate-100 bg-slate-50 p-5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          tone={
                            item.level === "立即处理"
                              ? "danger"
                              : item.level === "今天处理"
                                ? "medium"
                                : "low"
                          }
                        >
                          {item.level}
                        </Badge>
                        <span className="text-sm text-slate-500">{item.sender}</span>
                        {item.mailbox ? (
                          <span className="text-sm text-slate-400">· {item.mailbox}</span>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-lg font-medium text-slate-900">
                        {item.subject}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {item.summary}
                      </p>
                      <div className="mt-4 rounded-2xl bg-violet-50 p-4 text-sm leading-6 text-violet-800">
                        建议动作：{item.action}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-[1.7rem] border border-slate-100 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
                    {connectedCount > 0
                      ? "邮箱已经连接，但还没有同步结果。点击“立即同步”后，系统会按批次把邮件带进这里。"
                      : "当前还没有可展示的已连接邮箱邮件。连接邮箱并点击同步后，系统会在这里展示真正纳入分析的邮件。"}
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="已生成的任务与提醒"
              description="这里展示邮件被系统读取后，实际会推向任务中心和提醒流的内容。"
            >
              <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-3">
                  {generatedTasks.length > 0 ? (
                    generatedTasks.map((task) => (
                      <div
                        key={task.title}
                        className="rounded-[1.6rem] border border-slate-100 bg-white p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={task.priority === "高" ? "danger" : "medium"}>
                            {task.priority}优先
                          </Badge>
                          <Badge tone="default">{task.status}</Badge>
                          <span className="text-sm text-slate-500">{task.destination}</span>
                        </div>
                        <h3 className="mt-3 text-base font-medium text-slate-900">
                          {task.title}
                        </h3>
                        <p className="mt-2 text-sm text-slate-500">截止：{task.due}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{task.reason}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.6rem] border border-slate-100 bg-white p-4 text-sm leading-6 text-slate-500">
                      {connectedCount > 0
                        ? "当前还没有同步出任务；随着每次同步推进，需要回复或需要落实的邮件会逐批进入这里。"
                        : "连接邮箱后，系统会把需要回复或需要落实的邮件转成这里的任务。"}
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {reminders.length > 0 ? (
                    reminders.map((reminder) => (
                      <div
                        key={`${reminder.title}-${reminder.when}`}
                        className="rounded-[1.6rem] border border-slate-100 bg-slate-50 p-4"
                      >
                        <Badge tone={reminder.tone}>{reminder.when}</Badge>
                        <h3 className="mt-3 text-base font-medium text-slate-900">
                          {reminder.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {reminder.reason}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                      {connectedCount > 0
                        ? "继续执行同步后，这里会出现会前提醒、待回复提醒和事务处理提醒。"
                        : "连接邮箱并同步后，这里会显示会前提醒、待回复提醒和事务处理提醒。"}
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="判断面板"
              description="邮件页最重要的体验，不是收件箱本身，而是系统替你先做第一轮筛选。"
            >
              <div className="grid gap-4 md:grid-cols-3">
                {triagePanels.map((panel) => (
                  <div
                    key={panel.title}
                    className="rounded-[1.6rem] border border-slate-100 bg-white p-4"
                  >
                    <Badge tone={panel.tone}>{panel.title}</Badge>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {panel.description}
                    </p>
                    <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-500">
                      典型内容：{panel.examples}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="处理链路"
              description="这一页需要让别人一眼看懂，邮件进入系统后不是被看一眼，而是会沿着固定链路流向其它页面。"
            >
              <ol className="space-y-3">
                {emailWorkflow.map((step, index) => (
                  <li
                    key={step}
                    className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-4"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm leading-6 text-slate-600">{step}</span>
                  </li>
                ))}
              </ol>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard
              title="对首页日程的影响"
              description="邮件不只是生成待办；如果它带有明确时间，还会进入首页日程并参与自动改期。"
            >
              <div className="space-y-3">
                {scheduleImpacts.length > 0 ? (
                  scheduleImpacts.map((impact) => (
                    <div
                      key={`${impact.title}-${impact.when}`}
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="danger">{impact.when}</Badge>
                        <span className="text-sm text-slate-500">{impact.source}</span>
                      </div>
                      <h3 className="mt-3 text-base font-medium text-slate-900">
                        {impact.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{impact.action}</p>
                      <div className="mt-4 rounded-2xl bg-white p-3 text-sm leading-6 text-slate-500">
                        自动处理：{impact.conflictPlan}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                    {connectedCount > 0
                      ? "当前同步批次里还没有直接触发改期的项目；当新同步到会议、面试、出行等固定时间邮件时，会在这里显示。"
                      : "先连接邮箱并执行同步，系统才会判断哪些邮件会真正影响首页日程。"}
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="邮箱接入状态"
              description="这里保留产品说明层，方便你对外展示未来真实邮箱接入后的支持范围。"
            >
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          {account.provider}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {account.address}
                        </p>
                      </div>
                      <Badge tone={account.connected ? "success" : "medium"}>
                        {account.status}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{account.sync}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="自动归档结果"
              description="这部分用于证明系统确实会替你做减法，而不是把所有邮件都重新塞回主界面。"
            >
              <div className="space-y-3">
                {archiveDecisions.length > 0 ? (
                  archiveDecisions.map((decision) => (
                    <div
                      key={decision.subject}
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="success">已归档</Badge>
                        <span className="text-sm text-slate-500">{decision.mailbox}</span>
                      </div>
                      <h3 className="mt-3 text-base font-medium text-slate-900">
                        {decision.subject}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{decision.reason}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                    {connectedCount > 0
                      ? "当前同步批次里还没有被自动归档的邮件；营销通知和广告邮件同步进来后会在这里沉下去。"
                      : "连接邮箱后，系统会把广告、促销和泛通知自动沉到这里，而不是继续打断主视线。"}
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="落地顺序"
              description="这一页的下一步不该模糊，要能清楚说明怎样从原型过渡到真实可用。"
            >
              <div className="space-y-3">
                {landingSteps.map((step, index) => (
                  <div
                    key={step}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-600"
                  >
                    <span className="mr-2 font-semibold text-slate-900">
                      {index + 1}.
                    </span>
                    {step}
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="作品表达"
              description="对外展示时，这页应该突出你的产品会替用户做减法，而不是只把所有邮件重新堆一遍。"
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-violet-100 bg-violet-50/80 p-4 text-sm leading-6 text-violet-900">
                  邮件页负责回答“哪些信息值得我现在看”，而不是“我的邮箱里一共有多少封信”。
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm leading-6 text-emerald-900">
                  真正重要的邮件会被转成任务、提醒，必要时还会进一步影响首页日程。
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-sm leading-6 text-amber-900">
                  下一轮最值得继续补的是：把这些连接动作真正替换成 Gmail / Outlook / IMAP 的实际授权流程。
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      {connectionDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/28 px-4">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-violet-700">
                  {connectionDraft.mode === "oauth" ? "授权流程" : "IMAP 配置"}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                  {connectionDraft.provider}
                  {connectionDraft.mode === "oauth" ? " 连接向导" : " 接入向导"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  这里先模拟真实接入流程，让页面已经具备产品级的授权与配置体验。
                </p>
              </div>
              <button
                type="button"
                onClick={closeConnectionFlow}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                关闭
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {connectionDraft.mode === "oauth" ? (
                <>
                  <Badge tone={connectionDraft.step === "intro" ? "medium" : "default"}>
                    1. 基本信息
                  </Badge>
                  <Badge
                    tone={connectionDraft.step === "permissions" ? "medium" : "default"}
                  >
                    2. 权限确认
                  </Badge>
                  <Badge tone={connectionDraft.step === "confirm" ? "medium" : "default"}>
                    3. 发起授权
                  </Badge>
                  <Badge
                    tone={
                      connectionDraft.step === "oauth-inflight" ||
                      connectionDraft.step === "oauth-result"
                        ? "success"
                        : "default"
                    }
                  >
                    4. 授权结果
                  </Badge>
                </>
              ) : (
                <>
                  <Badge tone={connectionDraft.step === "intro" ? "medium" : "default"}>
                    1. 填写配置
                  </Badge>
                  <Badge
                    tone={connectionDraft.step === "imap-config" ? "medium" : "default"}
                  >
                    2. 配置已回写
                  </Badge>
                  <Badge
                    tone={
                      connectionDraft.step === "imap-verify-inflight" ||
                      connectionDraft.step === "imap-result"
                        ? "medium"
                        : "default"
                    }
                  >
                    3. 验证连接
                  </Badge>
                  <Badge tone={connectionDraft.step === "imap-result" ? "success" : "default"}>
                    4. 完成连接
                  </Badge>
                </>
              )}
            </div>

            {connectionDraft.mode === "oauth" ? (
              <div className="mt-6 space-y-4">
                {connectionDraft.step === "oauth-inflight" ? (
                  <>
                    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm leading-6 text-violet-900">
                      正在跳转到 {connectionDraft.provider} 授权页，请在弹窗中完成登录并允许所需权限。
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-violet-500" />
                        等待授权回调…（本演示版本可以用下方按钮手动选择模拟结果）
                      </div>
                    </div>
                  </>
                ) : connectionDraft.step === "oauth-result" ? (
                  <>
                    <div
                      className={`rounded-2xl border p-4 text-sm leading-6 ${
                        connectionDraft.oauthResultStatus === "已授权"
                          ? "border-emerald-100 bg-emerald-50 text-emerald-900"
                          : "border-rose-100 bg-rose-50 text-rose-900"
                      }`}
                    >
                      {connectionDraft.oauthResultStatus === "已授权"
                        ? "授权成功。现在可以完成邮箱连接，连接后即可同步邮件。"
                        : "授权未完成或被取消。可以重试授权或调整权限范围。"}
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-sm font-medium text-slate-900">授权结果</div>
                      <p className="mt-2 text-sm text-slate-600">
                        状态：
                        <span className="font-medium text-slate-900">
                          {connectionDraft.oauthResultStatus ?? "—"}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        说明：{connectionDraft.oauthResultMessage ?? "—"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        申请权限：{connectionDraft.permissions.join("、") ?? "—"}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-sm font-medium text-slate-900">授权邮箱</div>
                      <input
                        value={connectionDraft.email}
                        onChange={(event) => handleDraftChange("email", event.target.value)}
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300"
                      />
                    </div>

                    {connectionDraft.step !== "intro" ? (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="text-sm font-medium text-slate-900">将要申请的权限</div>
                        <div className="mt-3 space-y-2">
                          {connectionDraft.permissions.map((permission) => (
                            <div
                              key={permission}
                              className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600"
                            >
                              {permission}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {connectionDraft.step === "confirm" ? (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
                        点击下一步后，系统会把这个邮箱推进到「授权中」状态，并跳转到真实 {connectionDraft.provider} 登录页。本原型通过下方模拟按钮演示授权成功 / 失败两种结果。
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {connectionDraft.step === "intro" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-sm font-medium text-slate-900">邮箱地址</div>
                      <input
                        value={connectionDraft.email}
                        onChange={(event) => handleDraftChange("email", event.target.value)}
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300"
                      />
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-sm font-medium text-slate-900">IMAP 服务器</div>
                      <input
                        value={connectionDraft.host}
                        onChange={(event) => handleDraftChange("host", event.target.value)}
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300"
                      />
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-sm font-medium text-slate-900">端口</div>
                      <input
                        value={connectionDraft.port}
                        onChange={(event) => handleDraftChange("port", event.target.value)}
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300"
                      />
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-sm font-medium text-slate-900">应用专用密码</div>
                      <input
                        type="password"
                        value={connectionDraft.password}
                        onChange={(event) => handleDraftChange("password", event.target.value)}
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300"
                      />
                    </div>
                  </div>
                ) : connectionDraft.step === "imap-config" ? (
                  <>
                    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm leading-6 text-violet-900">
                      已把 IMAP 配置写入共享状态。接下来点击「验证 IMAP 连接」，系统会将该邮箱推进到「验证中」状态。
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="text-sm font-medium text-slate-900">邮箱地址</div>
                        <p className="mt-3 text-sm text-slate-600">{connectionDraft.email}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="text-sm font-medium text-slate-900">服务器:端口</div>
                        <p className="mt-3 text-sm text-slate-600">
                          {connectionDraft.host}:{connectionDraft.port}
                        </p>
                      </div>
                    </div>
                  </>
                ) : connectionDraft.step === "imap-verify-inflight" ? (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                      {connectionDraft.imapVerifyMessage ?? "正在验证 IMAP 连接…"}
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className={`rounded-2xl border p-4 text-sm leading-6 ${
                        connectionDraft.imapVerifyStatus === "验证成功"
                          ? "border-emerald-100 bg-emerald-50 text-emerald-900"
                          : "border-rose-100 bg-rose-50 text-rose-900"
                      }`}
                    >
                      {connectionDraft.imapVerifyStatus === "验证成功"
                        ? "验证通过。可以完成连接，连接后即可开始同步邮件。"
                        : "验证失败，请检查服务器地址、端口或应用专用密码后重试。"}
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-sm font-medium text-slate-900">验证结果</div>
                      <p className="mt-2 text-sm text-slate-600">
                        状态：
                        <span className="font-medium text-slate-900">
                          {connectionDraft.imapVerifyStatus ?? "—"}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        详情：{connectionDraft.imapVerifyMessage ?? "—"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {connectionError ? (
              <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {connectionError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {connectionDraft.mode === "oauth" && connectionDraft.step === "oauth-inflight" ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSimulateOAuth(false)}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-rose-200 hover:text-rose-700"
                  >
                    模拟授权失败
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSimulateOAuth(true)}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    模拟授权成功
                  </button>
                </>
              ) : connectionDraft.mode === "oauth" &&
                connectionDraft.step === "oauth-result" ? (
                <>
                  {connectionDraft.oauthResultStatus !== "已授权" ? (
                    <button
                      type="button"
                      onClick={() =>
                        setConnectionDraft((current) =>
                          current ? { ...current, step: "confirm" } : current,
                        )
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-violet-200 hover:text-violet-700"
                    >
                      重试授权
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleCompleteConnection}
                    disabled={connectionDraft.oauthResultStatus !== "已授权"}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    完成连接
                  </button>
                </>
              ) : connectionDraft.mode === "imap" &&
                connectionDraft.step === "imap-config" ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setConnectionDraft((current) =>
                        current ? { ...current, step: "intro" } : current,
                      )
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                  >
                    返回修改
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerifyImap(true)}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    验证 IMAP 连接（模拟成功）
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerifyImap(false)}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-rose-200 hover:text-rose-700"
                  >
                    模拟验证失败
                  </button>
                </>
              ) : connectionDraft.mode === "imap" &&
                connectionDraft.step === "imap-verify-inflight" ? (
                <button
                  type="button"
                  disabled
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white opacity-50"
                >
                  验证中…
                </button>
              ) : connectionDraft.mode === "imap" &&
                connectionDraft.step === "imap-result" ? (
                <>
                  {connectionDraft.imapVerifyStatus !== "验证成功" ? (
                    <button
                      type="button"
                      onClick={() =>
                        setConnectionDraft((current) =>
                          current ? { ...current, step: "intro" } : current,
                        )
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                    >
                      返回修改
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleCompleteConnection}
                    disabled={connectionDraft.imapVerifyStatus !== "验证成功"}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    完成连接
                  </button>
                </>
              ) : connectionDraft.step === "confirm" && connectionDraft.mode === "oauth" ? (
                <button
                  type="button"
                  onClick={handleAdvanceConnectionStep}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  开始 OAuth 授权
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAdvanceConnectionStep}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  {connectionDraft.mode === "oauth" && connectionDraft.step === "intro"
                    ? "下一步"
                    : connectionDraft.mode === "oauth"
                      ? "确认权限"
                      : "保存并进入验证"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
