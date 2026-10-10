import { AppShell } from "@/components/app-shell";
import { Badge, SectionCard } from "@/components/section-card";
import { inboxItems } from "@/lib/mock-data";

export default function CollectPage() {
  return (
    <AppShell
      title="收集箱"
      description="所有零散想法都先放进来，再慢慢决定它是任务、资料、计划还是可以直接忽略的内容。"
      highlight={{
        label: "当前待整理",
        value: `${inboxItems.length} 条`,
        hint: "这个页面强调先收下，再整理，避免一开始就被分类打断。",
      }}
    >
      <div className="space-y-6">
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
                  {inboxItems.length}
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">适合转任务</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                  1
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">适合保留灵感</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                  2
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
              {inboxItems.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[1.7rem] border border-slate-100 bg-slate-50 p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{item.source}</Badge>
                    <Badge tone="medium">{item.tag}</Badge>
                  </div>
                  <h3 className="mt-3 text-lg font-medium text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.note}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                    <span className="rounded-full bg-white px-3 py-1 text-slate-600">转任务</span>
                    <span className="rounded-full bg-white px-3 py-1 text-slate-600">加入计划</span>
                    <span className="rounded-full bg-white px-3 py-1 text-slate-600">归档资料</span>
                    <span className="rounded-full bg-white px-3 py-1 text-slate-600">忽略</span>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <div className="space-y-6">
            <SectionCard
              title="整理动作"
              description="为了让它更像完整作品，这里要表达的是清晰的分流逻辑，而不是一堆按钮。"
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

            <SectionCard
              title="对外展示重点"
              description="这页最重要的不是能不能录入，而是能否说明你的产品有清晰的信息减负逻辑。"
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm leading-6 text-slate-600">
                  先收集，再判断，不让分类动作打断思路。
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm leading-6 text-slate-600">
                  最终去向应该是任务、计划、资料库，而不是永远躺在收集箱里。
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
