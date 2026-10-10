export type EventCategory =
  | "会议"
  | "截止日"
  | "出行"
  | "考试"
  | "上课"
  | "活动"
  | "学习"
  | "健身";

export type SchedulePriority = 1 | 2 | 3;
export type ScheduleRecurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";
export type ScheduleRecurrenceEndType = "never" | "until" | "count";

export type ScheduleSource =
  | "系统生成"
  | "邮件同步"
  | "手动添加"
  | "固定习惯"
  | "AI建议";

export type ScheduleStatus = "scheduled" | "rescheduled";

export type CalendarHighlightEvent = {
  id: string;
  date: string;
  title: string;
  category: EventCategory;
  priority: SchedulePriority;
  time: string;
};

export type DailyScheduleItem = {
  id: string;
  date: string;
  title: string;
  category: EventCategory;
  start: string;
  end: string;
  timeUnknown?: boolean;
  endTimeInferred?: boolean;
  priority: SchedulePriority;
  source: ScheduleSource;
  note: string;
  showInMonth: boolean;
  status: ScheduleStatus;
  recurrence?: ScheduleRecurrence;
  recurrenceEndType?: ScheduleRecurrenceEndType;
  recurrenceEndsOn?: string;
  recurrenceCount?: number;
  recurrenceWeekdays?: number[];
  recurrenceMonthDay?: number;
  isRecurring?: boolean;
  seriesId?: string;
  skippedDates?: string[];
  exceptionForDate?: string;
  detachedFromSeries?: boolean;
  generatedFromRecurring?: boolean;
  rescheduledFrom?: {
    date: string;
    start: string;
    end: string;
    reason: string;
  };
};

export type RescheduleAlert = {
  id: string;
  title: string;
  detail: string;
  date: string;
  impact: string;
};

export type SecretarySuggestion = {
  id: string;
  type: "成长建议" | "线下活动";
  title: string;
  scheduleAt: string;
  summary: string;
  why: string;
  detail?: string;
  checklist?: string[];
};

export const assistantMetrics = [
  { label: "本月重要事件", value: "7", hint: "月历只显示高价值、非日常事项" },
  { label: "自动改期次数", value: "1", hint: "发现冲突后按优先级自动重排" },
  { label: "待确认建议", value: "2", hint: "AI 正在等待你决定是否加入日程" },
  { label: "今日站内提醒", value: "2", hint: "电脑端先做好，后续再接手机提醒" },
];

export const monthLabel = "2026 年 8 月";
export const selectedDate = "2026-08-12";

export const dailySchedule: DailyScheduleItem[] = [
  {
    id: "day-1",
    date: "2026-08-12",
    title: "深度学习论文阅读",
    category: "学习",
    start: "09:00",
    end: "10:30",
    priority: 2,
    source: "AI建议",
    note: "根据你准备毕业与求职转型的状态，安排每日固定学习时段。",
    showInMonth: false,
    status: "scheduled",
    isRecurring: true,
  },
  {
    id: "day-2",
    date: "2026-08-12",
    title: "修改简历中的项目描述",
    category: "学习",
    start: "11:00",
    end: "12:00",
    priority: 2,
    source: "系统生成",
    note: "配合本周求职探索目标，优先整理可投递版本。",
    showInMonth: false,
    status: "scheduled",
  },
  {
    id: "day-3",
    date: "2026-08-12",
    title: "导师临时组会",
    category: "会议",
    start: "15:00",
    end: "16:00",
    priority: 1,
    source: "邮件同步",
    note: "由导师邮件触发，自动识别为高优先级会议。",
    showInMonth: true,
    status: "scheduled",
  },
  {
    id: "day-4",
    date: "2026-08-12",
    title: "健身房训练",
    category: "健身",
    start: "16:00",
    end: "17:00",
    priority: 3,
    source: "固定习惯",
    note: "原本是 15:00-16:00，因导师会议自动顺延到 16:00-17:00。",
    showInMonth: false,
    status: "rescheduled",
    isRecurring: true,
    rescheduledFrom: {
      date: "2026-08-12",
      start: "15:00",
      end: "16:00",
      reason: "导师临时组会优先级更高，系统自动顺延。",
    },
  },
  {
    id: "day-5",
    date: "2026-08-12",
    title: "回复导师会后待办",
    category: "截止日",
    start: "20:00",
    end: "20:30",
    priority: 1,
    source: "系统生成",
    note: "会后整理结论，避免遗忘新增任务。",
    showInMonth: false,
    status: "scheduled",
  },
  {
    id: "day-6",
    date: "2026-08-18",
    title: "论文初稿截止",
    category: "截止日",
    start: "21:30",
    end: "23:59",
    priority: 1,
    source: "系统生成",
    note: "本月最关键的学业节点之一，需要在截止前留出最终检查时间。",
    showInMonth: true,
    status: "scheduled",
  },
  {
    id: "day-7",
    date: "2026-08-23",
    title: "电影节展映",
    category: "活动",
    start: "19:00",
    end: "21:30",
    priority: 3,
    source: "手动添加",
    note: "个人放松与恢复安排，仍然属于需要保留的重要非日常活动。",
    showInMonth: true,
    status: "scheduled",
  },
  {
    id: "day-8",
    date: "2026-08-25",
    title: "毕业答辩说明课",
    category: "上课",
    start: "10:00",
    end: "11:30",
    priority: 2,
    source: "系统生成",
    note: "与毕业流程强相关，需要提前准备问题和材料。",
    showInMonth: true,
    status: "scheduled",
  },
  {
    id: "day-9",
    date: "2026-08-28",
    title: "去上海参加面试",
    category: "出行",
    start: "07:20",
    end: "12:00",
    priority: 1,
    source: "手动添加",
    note: "面试相关出行安排，建议前一晚确认路线、证件与作品集链接。",
    showInMonth: true,
    status: "scheduled",
  },
  {
    id: "day-10",
    date: "2026-08-30",
    title: "演唱会",
    category: "活动",
    start: "20:00",
    end: "22:30",
    priority: 3,
    source: "手动添加",
    note: "个人生活安排，属于重要但不重复的活动，可以保留在月历视图中。",
    showInMonth: true,
    status: "scheduled",
  },
  {
    id: "day-11",
    date: "2026-08-05",
    title: "课程结课考试",
    category: "考试",
    start: "14:00",
    end: "16:00",
    priority: 1,
    source: "系统生成",
    note: "考试属于必须保留的高优先级事项，应在月历中重点强调。",
    showInMonth: true,
    status: "scheduled",
  },
];

export const highlightEvents: CalendarHighlightEvent[] = dailySchedule
  .filter((item) => item.showInMonth)
  .map((item) => ({
    id: item.id,
    date: item.date,
    title: item.title,
    category: item.category,
    priority: item.priority,
    time: item.start,
  }));

export const alerts: RescheduleAlert[] = [
  {
    id: "alert-1",
    title: "你的日程已自动更新",
    detail: "导师邮件新增了 15:00 组会，系统保留高优先级会议并自动重排后续安排。",
    date: "2026-08-12",
    impact: "健身已从 15:00 改到 16:00，站内提醒将在 14:30 和 15:50 发出。",
  },
  {
    id: "alert-2",
    title: "新增求职成长时段",
    detail: "根据你即将毕业、方向还在探索的状态，AI 建议本周每天固定 90 分钟学习。",
    date: "2026-08-12",
    impact: "今天 09:00 已安排论文阅读，明天建议改为行业研究与岗位分析。",
  },
];

export const suggestions: SecretarySuggestion[] = [
  {
    id: "sg-1",
    type: "成长建议",
    title: "给你加一段求职探索学习时间",
    scheduleAt: "2026-08-13 09:00-10:30",
    summary: "安排一段不被打扰的学习块，用来做行业方向探索和岗位信息整理。",
    why: "你提到自己临近毕业但就业方向还不确定，系统会优先帮你留出稳定的成长时间。",
    checklist: ["浏览 3 个感兴趣方向的 JD", "记录差距", "更新简历关键词"],
  },
  {
    id: "sg-2",
    type: "线下活动",
    title: "附近有一场适合应届生的招聘会",
    scheduleAt: "2026-08-21 09:30-12:00",
    summary: "城市人才中心招聘会，偏向应届生与校招补录岗位。",
    why: "它和你当前阶段高度相关，且离你常活动区域较近，值得确认是否参加。",
    detail: "地点：市人才服务中心 3 楼展厅。建议准备 3 份简历、学生证、作品链接和自我介绍。",
    checklist: ["打印简历", "准备 1 分钟自我介绍", "查看参会企业名单"],
  },
];

export const quickAddPresets = [
  "面试",
  "考试",
  "和导师开会",
  "电影",
  "线下活动",
  "自己安排的特别事项",
];

export const importantMonthCategories: EventCategory[] = [
  "会议",
  "截止日",
  "出行",
  "考试",
  "上课",
  "活动",
];

export const categoryColorMap: Record<EventCategory, string> = {
  会议: "bg-violet-100 text-violet-700 border-violet-200",
  截止日: "bg-rose-100 text-rose-700 border-rose-200",
  出行: "bg-sky-100 text-sky-700 border-sky-200",
  考试: "bg-amber-100 text-amber-700 border-amber-200",
  上课: "bg-indigo-100 text-indigo-700 border-indigo-200",
  活动: "bg-emerald-100 text-emerald-700 border-emerald-200",
  学习: "bg-slate-100 text-slate-700 border-slate-200",
  健身: "bg-orange-100 text-orange-700 border-orange-200",
};

export const weekDayLabels = ["一", "二", "三", "四", "五", "六", "日"];

export function shouldShowInMonth(item: DailyScheduleItem) {
  return item.showInMonth && importantMonthCategories.includes(item.category);
}

export function getMonthDays() {
  const year = 2026;
  const monthIndex = 7;
  const daysInMonth = 31;
  const firstDayJs = new Date(year, monthIndex, 1).getDay();
  const offset = firstDayJs === 0 ? 6 : firstDayJs - 1;

  const cells: Array<{
    key: string;
    date: string | null;
    dayNumber: number | null;
    events: CalendarHighlightEvent[];
    isCurrentMonth: boolean;
  }> = [];

  for (let i = 0; i < offset; i += 1) {
    cells.push({
      key: `blank-${i}`,
      date: null,
      dayNumber: null,
      events: [],
      isCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `2026-08-${String(day).padStart(2, "0")}`;
    cells.push({
      key: date,
      date,
      dayNumber: day,
      events: highlightEvents.filter((item) => item.date === date),
      isCurrentMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      key: `tail-${cells.length}`,
      date: null,
      dayNumber: null,
      events: [],
      isCurrentMonth: false,
    });
  }

  return cells;
}
