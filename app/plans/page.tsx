import { AppShell } from "@/components/app-shell";
import { Badge, SectionCard } from "@/components/section-card";
import { plans } from "@/lib/mock-data";

export default function PlansPage() {
  const todayPlan = plans.find((plan) => plan.period === "今日");
  const weekPlan = plans.find((plan) => plan.period === "本周");
  const monthPlan = plans.find((plan) => plan.period === "本月");

  return (
    <AppShell
      title="计划区"
      description="计划负责定义方向，任务负责推进执行。这样你既能看见今天要做什么，也不会丢掉长期目标。"
      highlight={{
        label: "设计原则",
        value: "计划不是待办清单",
        hint: "日、周、月三个层级足够支撑个人使用，不需要一开始做复杂项目树。",
      }}
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.period}
              className="rounded-[1.8rem] border border-white/75 bg-white/78 p-5 shadow-[0_16px_38px_rgba(148,163,184,0.12)] backdrop-blur-xl"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-500">{plan.period}计划</div>
                <Badge tone={plan.progress >= 70 ? "success" : plan.progress >= 50 ? "medium" : "default"}>
                  {plan.progress}%
                </Badge>
              </div>
              <div className="mt-3 text-xl font-semibold tracking-[-0.03em] text-slate-900">
                {plan.title}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{plan.focus}</p>
              <div className="mt-5 rounded-full bg-slate-100 p-1">
                <div
                  className="h-3 rounded-full bg-violet-500"
                  style={{ width: `${plan.progress}%` }}
                />
              </div>
            </div>
          ))}
        </section>

        <SectionCard
          title="计划层级"
          description="从今天到本月的推进关系，让你既能看见今天要做什么，也不会丢掉长期目标。"
        >
          <div className="space-y-4">
            <article className="rounded-[1.7rem] border border-slate-100 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="default">今日</Badge>
                <span className="text-sm text-slate-500">把今天的动作压缩到真正能推进结果的 1-2 件事</span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">{todayPlan?.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{todayPlan?.focus}</p>
            </article>

            <article className="rounded-[1.7rem] border border-slate-100 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="medium">本周</Badge>
                <span className="text-sm text-slate-500">把零散任务组织成一个可见的推进阶段</span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">{weekPlan?.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{weekPlan?.focus}</p>
            </article>

            <article className="rounded-[1.7rem] border border-slate-100 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success">本月</Badge>
                <span className="text-sm text-slate-500">用更长期的视角判断这个系统是否真的开始服务你的生活</span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">{monthPlan?.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{monthPlan?.focus}</p>
            </article>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
