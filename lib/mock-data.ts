export type NavItem = {
  href: string;
  label: string;
  description: string;
};

export type StatItem = {
  label: string;
  value: string;
  hint: string;
};

export type InboxItem = {
  title: string;
  source: string;
  note: string;
  tag: string;
};

export type TaskItem = {
  title: string;
  priority: "高" | "中" | "低";
  due: string;
  status: "待开始" | "进行中" | "待回复" | "已完成";
  plan: string;
};

export type PlanItem = {
  period: string;
  title: string;
  focus: string;
  progress: number;
};

export type EmailAccount = {
  provider: string;
  address: string;
  status: string;
  sync: string;
};

export type EmailInsight = {
  level: "立即处理" | "今天处理" | "可忽略";
  subject: string;
  sender: string;
  summary: string;
  action: string;
  mailbox?: string;
  deadline?: string;
  intent?: "reply" | "todo" | "ignore" | "schedule";
  triggersSchedule?: boolean;
};

export type ReviewPoint = {
  title: string;
  content: string;
};

export const navItems: NavItem[] = [
  { href: "/", label: "首页", description: "今天与提醒" },
  { href: "/collect", label: "收集", description: "想法与资料" },
  { href: "/tasks", label: "任务", description: "待办与状态" },
  { href: "/plans", label: "计划", description: "日周月目标" },
  { href: "/email", label: "邮件智能中心", description: "汇总、分类、提醒" },
  { href: "/review", label: "回顾", description: "总结与调整" },
];

export const overviewStats: StatItem[] = [
  { label: "今日任务", value: "7", hint: "其中 2 个需要优先完成" },
  { label: "待回复邮件", value: "5", hint: "3 封建议今天 18:00 前处理" },
  { label: "本周计划进度", value: "68%", hint: "写作与账单整理仍需推进" },
  { label: "自动忽略邮件", value: "12", hint: "广告、促销和订阅已归档" },
];

export const inboxItems: InboxItem[] = [
  {
    title: "8 月旅行预算还没整理",
    source: "快速记录",
    note: "拆成机票、住宿、签证三个任务",
    tag: "待转任务",
  },
  {
    title: "读完《深度工作》后做一页摘要",
    source: "阅读摘录",
    note: "可以加入周回顾模板",
    tag: "灵感",
  },
  {
    title: "看到一个不错的自动记账工具",
    source: "收藏链接",
    note: "与个人效率工具做一轮对比",
    tag: "待研究",
  },
];

export const tasks: TaskItem[] = [
  {
    title: "整理本周个人网站需求草图",
    priority: "高",
    due: "今天 16:00",
    status: "进行中",
    plan: "本周 MVP",
  },
  {
    title: "回复合作方关于排期的邮件",
    priority: "高",
    due: "今天 18:00",
    status: "待回复",
    plan: "今日重点",
  },
  {
    title: "完成 8 月预算表",
    priority: "中",
    due: "明天",
    status: "待开始",
    plan: "本周生活管理",
  },
  {
    title: "更新阅读清单与摘要",
    priority: "低",
    due: "周日",
    status: "待开始",
    plan: "周回顾",
  },
];

export const plans: PlanItem[] = [
  {
    period: "今日",
    title: "把 MVP 骨架跑起来",
    focus: "首页、任务、提醒、邮件智能中心",
    progress: 80,
  },
  {
    period: "本周",
    title: "建立个人执行系统",
    focus: "收集、计划、任务、回顾形成闭环",
    progress: 68,
  },
  {
    period: "本月",
    title: "让网站真正开始服务日常生活",
    focus: "接入真实邮箱与通知，开始日常使用",
    progress: 32,
  },
];

export const emailAccounts: EmailAccount[] = [
  {
    provider: "Gmail",
    address: "me.work@gmail.com",
    status: "待接入 OAuth",
    sync: "计划每 30 分钟同步",
  },
  {
    provider: "Outlook",
    address: "me.personal@outlook.com",
    status: "待接入 OAuth",
    sync: "计划每 30 分钟同步",
  },
  {
    provider: "IMAP 自定义邮箱",
    address: "hello@mydomain.com",
    status: "待配置 IMAP",
    sync: "计划每 60 分钟同步",
  },
];

export const emailInsights: EmailInsight[] = [
  {
    level: "立即处理",
    subject: "合作方案确认，本周五前需要回复",
    sender: "Lina / 合作方",
    summary: "邮件明确要求你确认报价与交付时间，带有截止日期。",
    action: "生成待回复任务，并在今天 17:30 前提醒",
    mailbox: "Gmail",
    deadline: "今天 17:30",
    intent: "reply",
  },
  {
    level: "立即处理",
    subject: "导师确认：明天 15:00 项目评审会议",
    sender: "导师 / 学校邮箱",
    summary: "这封邮件带有明确会议时间，并要求你在会前准备最新版本文档。",
    action: "加入首页日程，并将同时间段的低优先安排自动后移",
    mailbox: "学校邮箱",
    deadline: "明天 15:00",
    intent: "schedule",
    triggersSchedule: true,
  },
  {
    level: "今天处理",
    subject: "银行账单提醒与自动扣款失败通知",
    sender: "Bank Notice",
    summary: "属于事务性邮件，可能影响信用卡或账单缴费。",
    action: "加入今日待办，标记为中高优先级",
    mailbox: "Outlook",
    deadline: "今天 18:00",
    intent: "todo",
  },
  {
    level: "可忽略",
    subject: "夏季限时折扣，精选商品低至五折",
    sender: "Shop Weekly",
    summary: "促销类广告，无明确动作要求。",
    action: "自动归档到广告箱，不提醒",
    mailbox: "Gmail",
    intent: "ignore",
  },
];

export const reviewPoints: ReviewPoint[] = [
  {
    title: "完成率",
    content: "本周高优先级任务推进顺利，但低优先级阅读任务持续积压。",
  },
  {
    title: "拖延点",
    content: "需要回复的邮件没有在固定时间集中处理，容易被打断。",
  },
  {
    title: "调整建议",
    content: "把每天 17:00 设为统一邮件处理时段，并只保留高价值提醒。",
  },
];

export const emailWorkflow = [
  "聚合多个邮箱的新邮件",
  "提取发件人、主题、截止时间、动作词",
  "判断是重要回复、待办事务还是广告垃圾",
  "生成摘要、提醒和可执行任务",
];
