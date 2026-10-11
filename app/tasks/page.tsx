"use client";

import Link from "next/link";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge, SectionCard } from "@/components/section-card";
import {
  buildHomeDashboardHref,
  EMAIL_CONNECTION_STORAGE_KEY,
  EMAIL_CONNECTIONS_UPDATED_EVENT,
  parseTaskCenterIntent,
  resolveTaskDueTargetDate,
  seedDemoDataIfEmpty,
  TASK_CENTER_STORAGE_KEY,
  getDefaultTaskCenterTasks,
  getPersistedEmailConnections,
  mergeEmailTasksIntoTaskCenter,
  type PersistedTaskCenterState,
  type TaskCenterItem,
} from "@/lib/workspace-sync";

function getTodayDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
}

export default function TasksPage() {
  const [taskItems, setTaskItems] = useState<TaskCenterItem[]>(getDefaultTaskCenterTasks());
  const [isHydrated, setIsHydrated] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [focusEmailGenerated, setFocusEmailGenerated] = useState(false);

  useEffect(() => {
    seedDemoDataIfEmpty(getTodayDate());

    let nextTasks = getDefaultTaskCenterTasks();
    const nextAccounts = getPersistedEmailConnections();

    try {
      const raw = window.localStorage.getItem(TASK_CENTER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedTaskCenterState>;
        nextTasks = parsed.tasks?.length ? parsed.tasks : nextTasks;
      }
    } catch {
    }

    queueMicrotask(() => {
      setTaskItems(mergeEmailTasksIntoTaskCenter(nextTasks, nextAccounts));
      setIsHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(
      TASK_CENTER_STORAGE_KEY,
      JSON.stringify({ tasks: taskItems }),
    );
  }, [isHydrated, taskItems]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const refreshFromEmailSync = () => {
      const accounts = getPersistedEmailConnections();
      setTaskItems((current) => mergeEmailTasksIntoTaskCenter(current, accounts));
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === EMAIL_CONNECTION_STORAGE_KEY) {
        refreshFromEmailSync();
      }
    };

    window.addEventListener(EMAIL_CONNECTIONS_UPDATED_EVENT, refreshFromEmailSync);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(EMAIL_CONNECTIONS_UPDATED_EVENT, refreshFromEmailSync);
      window.removeEventListener("storage", handleStorage);
    };
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const intent = parseTaskCenterIntent(
      typeof window !== "undefined" ? window.location.search : null,
    );
    if (!intent.focusEmailGenerated && !intent.focusTaskId) {
      return;
    }
    window.requestAnimationFrame(() => {
      if (intent.focusTaskId) {
        const match =
          taskItems.find((task) => task.id === intent.focusTaskId) ??
          taskItems.find(
            (task) =>
              task.sourceType === "email" &&
              intent.focusTaskId &&
              task.id.toLowerCase() === intent.focusTaskId.toLowerCase(),
          );
        if (match) {
          setFocusedTaskId(match.id);
          window.setTimeout(() => setFocusedTaskId(null), 2800);
          window.requestAnimationFrame(() => {
            const el = document.getElementById(`task-row-${match.id}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
          return;
        }
      }
      if (intent.focusEmailGenerated) {
        setFocusEmailGenerated(true);
        window.requestAnimationFrame(() => {
          const firstEmailTask = taskItems.find((task) => task.sourceType === "email");
          if (firstEmailTask) {
            const el = document.getElementById(`task-row-${firstEmailTask.id}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          } else {
            const el = document.getElementById("task-center-email-anchor");
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        });
        window.setTimeout(() => setFocusEmailGenerated(false), 2800);
      }
    });
  }, [isHydrated, taskItems]);

  const pendingCount = taskItems.filter((task) => task.status !== "已完成").length;
  const replyingCount = taskItems.filter((task) => task.status === "待回复").length;
  const highPriorityCount = taskItems.filter((task) => task.priority === "高").length;
  const emailGeneratedCount = taskItems.filter((task) => task.sourceType === "email").length;

  function handleToggleComplete(taskId: string) {
    setTaskItems((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, status: task.status === "已完成" ? "待开始" : "已完成" }
          : task,
      ),
    );
  }

  function handleDeleteTask(taskId: string) {
    setTaskItems((current) => current.filter((task) => task.id !== taskId));
  }

  return (
    <AppShell
      title="任务中心"
      description="这里是网站的执行层。任务来自手动创建，也可以由邮件智能分析后自动生成待回复和待办项。"
      highlight={{
        label: "任务视角",
        value: "把邮件变成行动",
        hint: "收到重要邮件后，不是只标记未读，而是直接转成可追踪任务。",
      }}
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.8rem] border border-white/75 bg-white/78 p-5 shadow-[0_16px_38px_rgba(148,163,184,0.12)] backdrop-blur-xl">
            <div className="text-sm font-medium text-slate-500">当前待推进</div>
            <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
              {pendingCount}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              先把真正需要推进的事收拢出来，不让低价值事项淹没今天的节奏。
            </p>
          </div>
          <div className="rounded-[1.8rem] border border-white/75 bg-white/78 p-5 shadow-[0_16px_38px_rgba(148,163,184,0.12)] backdrop-blur-xl">
            <div className="text-sm font-medium text-slate-500">待回复任务</div>
            <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
              {replyingCount}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              这些任务更适合归到固定的邮件处理时段，而不是随时打断你。
            </p>
          </div>
          <div className="rounded-[1.8rem] border border-white/75 bg-white/78 p-5 shadow-[0_16px_38px_rgba(148,163,184,0.12)] backdrop-blur-xl">
            <div className="text-sm font-medium text-slate-500">高优先事项</div>
            <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
              {highPriorityCount}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              真正要先守住的是有明确截止和外部约束的任务，而不是看起来很忙的所有事。
            </p>
          </div>
          <div className="rounded-[1.8rem] border border-white/75 bg-white/78 p-5 shadow-[0_16px_38px_rgba(148,163,184,0.12)] backdrop-blur-xl md:col-span-3 xl:col-span-1">
            <div className="text-sm font-medium text-slate-500">邮件自动生成</div>
            <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
              {emailGeneratedCount}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              只有完成同步的邮箱邮件才会进入这里，任务中心不再继续吃固定样例结果。
            </p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <SectionCard
            title="任务列表"
            description="这一页不只是堆待办，而是把今天该推进的、需要回复的、和可以后移的任务放在同一个视图里。"
          >
            <div className="hidden grid-cols-[2.1fr_1fr_1fr_1fr_1.1fr_0.8fr] gap-3 bg-slate-50 px-5 py-4 text-sm font-medium text-slate-500 md:grid">
              <div>任务</div>
              <div>优先级</div>
              <div>截止时间</div>
              <div>状态</div>
              <div>首页联动</div>
              <div>操作</div>
            </div>
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {taskItems.map((task, index) => {
                const targetDate = resolveTaskDueTargetDate(task);
                const dayFlowHref = buildHomeDashboardHref({ mode: "day", date: targetDate });
                const alertsHref = buildHomeDashboardHref({ mode: "alerts", date: targetDate });
                const isFirstEmailRow =
                  index === taskItems.findIndex((item) => item.sourceType === "email");
                const isFocused = focusedTaskId === task.id;
                const hasFilterBlink =
                  focusEmailGenerated && task.sourceType === "email";

                return (
                  <div
                    key={`${task.plan}-${task.title}`}
                    id={`task-row-${task.id}`}
                    className={`grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-[2.1fr_1fr_1fr_1fr_1.1fr_0.8fr] md:items-start transition-all duration-300 ease-out ${
                      isFocused || hasFilterBlink
                        ? "bg-[linear-gradient(180deg,rgba(251,191,36,0.10),rgba(251,191,36,0.02))] shadow-[inset_4px_0_0_rgba(251,191,36,0.7)]"
                        : ""
                    } ${task.status === "已完成" ? "opacity-60" : ""}`}
                  >
                    {isFirstEmailRow ? (
                      <span id="task-center-email-anchor" className="sr-only">
                        邮件自动生成任务起点
                      </span>
                    ) : null}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`font-medium text-slate-900 ${task.status === "已完成" ? "line-through" : ""}`}>{task.title}</p>
                        <Badge tone="default">{task.plan}</Badge>
                        {task.sourceType === "email" ? (
                          <Badge tone="medium">邮件同步</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {task.reason}
                      </p>
                    </div>
                    <div className="md:pt-1">
                      <Badge
                        tone={
                          task.priority === "高"
                            ? "high"
                            : task.priority === "中"
                              ? "medium"
                              : "low"
                        }
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium text-slate-700 md:pt-1">
                      <div>{task.due}</div>
                      <div className="mt-1 text-xs text-slate-400">目标日期 {targetDate}</div>
                    </div>
                    <div className="md:pt-1">
                      <Badge tone={task.status === "已完成" ? "success" : "default"}>
                        {task.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 md:pt-1">
                      <Link
                        href={dayFlowHref}
                        className="inline-flex items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100"
                      >
                        去首页看当日流程
                      </Link>
                      <Link
                        href={alertsHref}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-violet-200 hover:text-violet-700"
                      >
                        定位到当日提醒
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2 md:pt-1">
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(task.id)}
                        className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-medium transition ${
                          task.status === "已完成"
                            ? "border border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200"
                            : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {task.status === "已完成" ? "取消完成" : "标记完成"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <div className="space-y-6">
            <SectionCard
              title="执行节奏建议"
              description="让任务页看起来像你的执行面板，而不是普通清单。"
            >
              <div className="space-y-3 text-sm leading-6 text-slate-600">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  上午先推进一个高优先任务，避免一开始就被待回复邮件打散注意力。
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  把待回复任务集中到固定时段处理，会比随看随回更稳定。
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  低优先任务保留在这里即可，不要硬塞进首页月历去抢占视觉重点。
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  邮件自动生成的任务优先进入这里，再决定是否继续影响首页日程和提醒区。
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="邮件联动结果"
              description="这部分用来说明任务中心已经开始承接邮件智能中心的输出。"
            >
              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm leading-6 text-emerald-900">
                  当前已同步落盘 {emailGeneratedCount} 条邮件生成任务，刷新页面后也会继续保留在任务中心。
                </div>
                <div className="rounded-2xl border border-violet-100 bg-violet-50/80 p-4 text-sm leading-6 text-violet-900">
                  现在任务中心会读取邮箱同步状态，只承接真正同步到位的邮件结果。
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-sm leading-6 text-amber-900">
                  带固定时间的邮件事件已经在邮件页生成日程影响，下一层就是直接写入首页月历。
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
