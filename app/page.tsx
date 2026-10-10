import { AppShell } from "@/components/app-shell";
import { CalendarDashboard } from "@/components/calendar-dashboard";

export default function Home() {
  return (
    <AppShell
      title="打开网站，先看这个月最重要的事"
      description="首页现在优先是月历视图。它只展示会议、截止日、出行、考试、上课、电影、演唱会和你手动加入的重要事项；像健身这类日常安排则放进下一级的当日流程中。"
      showPageIntro={false}
      highlight={{
        label: "AI 智能秘书",
        value: "会根据实时变化自动改日程",
        hint: "例如导师突然发来 15:00 开会邮件，系统会保留高优先级会议，再把健身自动挪到 16:00 或其它合理空档。",
      }}
    >
      <CalendarDashboard />
    </AppShell>
  );
}
