import { AppShell } from "@/components/app-shell";
import { Badge, SectionCard } from "@/components/section-card";
import { reviewPoints } from "@/lib/mock-data";

export default function ReviewPage() {
  const weeklySignals = [
    {
      label: "本周保留下来的重点",
      value: "3 个",
      hint: "把真正推进结果的事情留下来，其余信息不要继续叠加。",
    },
    {
      label: "需要做减法的来源",
      value: "2 类",
      hint: "主要是零碎提醒过多，以及待回复邮件总在打断任务节奏。",
    },
    {
      label: "下周继续沿用的动作",
      value: "3 条",
      hint: "不是重新规划一切，而是把已经有效的节奏保留下来。",
    },
  ];

  const rhythmChecks = [
    {
      title: "任务推进",
      description: "高优先任务推进正常，说明首页月历和任务页已经能守住主线。",
      tone: "success" as const,
    },
    {
      title: "注意力干扰",
      description: "待回复邮件仍然容易打断深度工作，说明邮件时段还没有真正被锁住。",
      tone: "medium" as const,
    },
    {
      title: "提醒负担",
      description: "如果提醒没有继续做减法，系统会很快重新变成新的信息噪音。",
      tone: "danger" as const,
    },
  ];

  const nextWeekActions = [
    "把每天 17:00 固定为邮件处理时段，只在这个时间集中查看待回复事项。",
    "继续保留首页月历只展示重要事项的策略，不让日常重复安排重新挤占视线。",
    "给任务页补一层来源联动，让邮件生成的任务能直接解释“为什么现在要做”。",
  ];

  return (
    <AppShell
      title="回顾与调整"
      description="回顾页不只是写总结，而是帮你判断这套 AI 秘书系统这一周到底哪里真的有用、哪里开始重新制造负担。"
      highlight={{
        label: "本页角色",
        value: "把复盘变成下一周动作",
        hint: "好的回顾不是记录很多感受，而是识别卡点、保留有效节奏，再把调整动作带回任务和日程里。",
      }}
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          {weeklySignals.map((item) => (
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
              title="本周复盘视角"
              description="这部分负责回答：这周真正发生了什么、哪里推进顺了、哪里在反复消耗你。"
            >
              <div className="space-y-4">
                {reviewPoints.map((point, index) => (
                  <article
                    key={point.title}
                    className="rounded-[1.7rem] border border-slate-100 bg-slate-50 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          index === 0 ? "success" : index === 1 ? "medium" : "default"
                        }
                      >
                        {point.title}
                      </Badge>
                      <span className="text-sm text-slate-500">
                        {index === 0
                          ? "看结果有没有被推动"
                          : index === 1
                            ? "看注意力被什么打散"
                            : "看下周应该如何调整"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{point.content}</p>
                  </article>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="行为与节奏"
              description="回顾页最有价值的部分，是把感受转成可持续的节奏判断。"
            >
              <div className="grid gap-4 md:grid-cols-3">
                {rhythmChecks.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[1.6rem] border border-slate-100 bg-white p-4"
                  >
                    <Badge tone={item.tone}>{item.title}</Badge>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard
              title="下周调整动作"
              description="复盘结束后应该立刻留下可以执行的动作，而不是停留在感受层。"
            >
              <div className="space-y-3">
                {nextWeekActions.map((action, index) => (
                  <div
                    key={action}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-600"
                  >
                    <span className="mr-2 font-semibold text-slate-900">
                      {index + 1}.
                    </span>
                    {action}
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="作品表达"
              description="对外展示时，这页应该让别人看到你的产品会复盘系统本身，而不是只记录情绪。"
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-violet-100 bg-violet-50/80 p-4 text-sm leading-6 text-violet-900">
                  回顾页负责回答“这个系统有没有真的帮你减少负担，并且让下周更清楚”。
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm leading-6 text-emerald-900">
                  首页是时间视角，任务页是执行视角，计划页是方向视角，回顾页则是调整视角。
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-sm leading-6 text-amber-900">
                  下一轮最值得继续补的是：把回顾结论一键回写到计划、任务和提醒规则里。
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
