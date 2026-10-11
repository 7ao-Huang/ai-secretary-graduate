"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, SectionCard } from "@/components/section-card";
import { inboxItems as defaultInboxItems, type InboxItem } from "@/lib/mock-data";
import { addManualTask } from "@/lib/workspace-sync";

type HandledState = "pending" | "task" | "plan" | "archive" | "ignore";

export default function CollectPage() {
  const router = useRouter();
  const [items, setItems] = useState<(InboxItem & { state: HandledState })[]>(
    defaultInboxItems.map((item) => ({ ...item, state: "pending" as HandledState })),
  );
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const pendingCount = items.filter((i) => i.state === "pending").length;

  const handleConvertToTask = (item: InboxItem) => {
    const task = addManualTask({
      title: item.title,
      priority: item.tag === "待转任务" ? "高" : "中",
      due: "本周",
      reason: item.note,
      plan: "来自收集箱",
    });
    setItems((prev) =>
      prev.map((i) => (i.title === item.title ? { ...i, state: "task" } : i)),
    );
    showToast(`已转入任务中心：${item.title}`);
    router.push(`/tasks?focus=manual&taskId=${task.id}`);
  };

  const handleAddToPlan = (item: InboxItem) => {
    setItems((prev) =>
      prev.map((i) => (i.title === item.title ? { ...i, state: "plan" } : i)),
    );
    showToast(`已加入计划层：${item.title}`);
  };

  const handleArchive = (item: InboxItem) => {
    setItems((prev) =>
      prev.map((i) => (i.title === item.title ? { ...i, state: "archive" } : i)),
    );
    showToast(`已归档到资料库：${item.title}`);
  };

  const handleIgnore = (item: InboxItem) => {
    setItems((prev) =>
      prev.map((i) => (i.title === item.title ? { ...i, state: "ignore" } : i)),
    );
    showToast(`已忽略：${item.title}`);
  };

  const visibleItems = items.filter((i) => i.state === "pending");

  return (
    <AppShell
      title="收集箱"
      description="所有零散想法都先放进来，再慢慢决定它是任务、资料、计划还是可以直接忽略的内容。"
      highlight={{
        label: "当前待整理",
        value: `${pendingCount} 条`,
        hint: "这个页面强调先收下，再整理，避免一开始就被分类打断。",
      }}
    >
      <div className="space-y-6">
        {toast && (
          <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        )}

        <section className="rounded-[2rem] border border-white/75 bg-white/78 p-6 shadow-[0_16px_38px_rgba(148,163,184,0.12)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-sm font-medium text-slate-500">收集入口</div>
              <div className="mt-3 rounded-[1.6rem] border border-slate-200 bg-slate-50 px-5 py-4 text-[15px] text-slate-400">
                在这里随手输入想法、链接、灵感、待办或邮件摘要，先收下，再让系统判断去向。
              </div>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-3 xl:max-w-[30rem]">
              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">待整理</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                  {pendingCount}
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">适合转任务</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                  {visibleItems.filter((i) => i.tag === "待转任务").length}
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">适合保留灵感</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                  {visibleItems.filter((i) => i.tag === "灵感" || i.tag === "待研究").length}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <SectionCard
            title="待整理内容"
            description="可以来自快速记录、收藏链接、语音转文字，甚至来自邮件摘要自动转入。重点不是马上分类，而是不要让它们消失。"
          >
            <div className="space-y-3">
              {visibleItems.length > 0 ? (
                visibleItems.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-[1.7rem] border border-slate-100 bg-slate-50 p-5 transition hover:border-slate-200"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{item.source}</Badge>
                      <Badge tone="medium">{item.tag}</Badge>
                    </div>
                    <h3 className="mt-3 text-lg font-medium text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.note}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleConvertToTask(item)}
                        className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
                      >
                        转任务
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddToPlan(item)}
                        className="rounded-full bg-violet-100 px-3.5 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-200"
                      >
                        加入计划
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchive(item)}
                        className="rounded-full bg-amber-100 px-3.5 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-200"
                      >
                        归档资料
                      </button>
                      <button
                        type="button"
                        onClick={() => handleIgnore(item)}
                        className="rounded-full bg-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-300"
                      >
                        忽略
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[1.7rem] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
                  收集箱已清空，所有内容都已分流到任务、计划或资料库。
                </div>
              )}
            </div>
          </SectionCard>

          <div className="space-y-6">
            <SectionCard
              title="整理动作"
              description="清晰的分流逻辑，让收集进来的内容有明确的去处。"
            >
              <div className="space-y-3 text-sm leading-6 text-slate-600">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
                  转成任务：适合有明确下一步动作的事情，比如预算拆分、回复邮件、补资料。
                </div>
                <div className="rounded-2xl border border-violet-100 bg-violet-50/80 p-4">
                  加入计划：适合阶段性目标、成长方向、需要持续推进但还不到今天就做的内容。
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
                  归档资料：适合保留灵感、链接和参考，但不应该打扰首页和任务区。
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  忽略：对于已经没有价值或重复的信息直接清掉，避免系统越来越吵。
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
