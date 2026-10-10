import type {
  DailyScheduleItem,
  RescheduleAlert,
  SchedulePriority,
  ScheduleRecurrence,
} from "@/lib/secretary-data";

type ScheduleMutationReason = "create" | "update" | "suggestion";

type ScheduleEngineOptions = {
  items: DailyScheduleItem[];
  incoming: DailyScheduleItem;
  previousItem?: DailyScheduleItem;
  reason: ScheduleMutationReason;
};

type DayPlacementResult = {
  items: DailyScheduleItem[];
  alerts: RescheduleAlert[];
};

type TimeRange = {
  start: number;
  end: number;
};

type PlacementSnapshot = {
  date: string;
  start: string;
  end: string;
};

type PriorityInferenceInput = Pick<
  DailyScheduleItem,
  "title" | "category" | "source" | "note" | "showInMonth" | "recurrence"
>;

export type ScheduleMutationResult = {
  items: DailyScheduleItem[];
  alerts: RescheduleAlert[];
  savedItem: DailyScheduleItem;
};

export type SchedulePriorityExplanation = {
  priority: SchedulePriority;
  flexibilityLabel: "强约束" | "中等约束" | "可灵活调整";
  flexibilityTone: "danger" | "medium" | "low";
  reason: string;
};

export function sortScheduleItems(items: DailyScheduleItem[]) {
  return [...items].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    if (left.start !== right.start) {
      return left.start.localeCompare(right.start);
    }

    return left.priority - right.priority;
  });
}

export function inferSchedulePriority(item: PriorityInferenceInput): SchedulePriority {
  return explainSchedulePriority(item).priority;
}

export function explainSchedulePriority(item: PriorityInferenceInput): SchedulePriorityExplanation {
  const text = `${item.title} ${item.note}`.toLowerCase();
  const recurring = item.recurrence && item.recurrence !== "none";

  const hardConstraintKeywords = [
    "面试",
    "机票",
    "航班",
    "火车",
    "高铁",
    "答辩",
    "论文",
    "导师",
    "会议",
    "开会",
    "ddl",
    "截止",
    "简历",
    "工作",
    "学习",
    "招聘会",
    "演唱会",
    "展映",
    "答疑",
    "汇报",
    "笔试",
    "机考",
    "答辩",
    "提交",
    "报名截止",
    "返程",
    "出发",
  ];

  const importantKeywords = [
    "活动",
    "出行",
    "课程",
    "上课",
    "考试",
    "复盘",
    "回顾",
    "练习",
  ];

  const flexibleLeisureKeywords = [
    "麻将",
    "桌游",
    "聚餐",
    "约饭",
    "做饭",
    "party",
    "派对",
    "逛街",
    "看电影",
    "电影",
    "打球",
    "篮球",
    "羽毛球",
    "散步",
    "聚会",
  ];

  const scarceEventKeywords = [
    "演唱会",
    "展映",
    "首映",
    "电影节",
    "抢票",
    "门票",
    "航班",
    "机票",
    "高铁",
    "火车",
  ];

  if (flexibleLeisureKeywords.some((keyword) => text.includes(keyword))) {
    if (scarceEventKeywords.some((keyword) => text.includes(keyword))) {
      return {
        priority: 1,
        flexibilityLabel: "强约束",
        flexibilityTone: "danger",
        reason: "虽然偏休闲，但这类活动时间窗口固定，错过后通常很难补回来。",
      };
    }

    return {
      priority: item.showInMonth ? 2 : 3,
      flexibilityLabel: item.showInMonth ? "中等约束" : "可灵活调整",
      flexibilityTone: item.showInMonth ? "medium" : "low",
      reason: "这是可协商调整的休闲活动，保留时间信息，但默认不占最高优先级。",
    };
  }

  if (
    item.source === "邮件同步" ||
    ["会议", "截止日", "出行", "考试", "上课", "学习"].includes(item.category) ||
    hardConstraintKeywords.some((keyword) => text.includes(keyword))
  ) {
    return {
      priority: 1,
      flexibilityLabel: "强约束",
      flexibilityTone: "danger",
      reason: "这类事项通常和截止、考试、会议、出行等强时间约束相关，改期成本高。",
    };
  }

  if (
    item.showInMonth ||
    item.category === "活动" ||
    importantKeywords.some((keyword) => text.includes(keyword))
  ) {
    return {
      priority: 2,
      flexibilityLabel: "中等约束",
      flexibilityTone: "medium",
      reason: recurring
        ? "这是持续性的安排，值得保留，但一般仍可以围绕更关键的事项微调。"
        : "这类事项有一定重要性，建议保留，但必要时仍可以协调调整。",
    };
  }

  if (item.category === "健身") {
    return {
      priority: 3,
      flexibilityLabel: "可灵活调整",
      flexibilityTone: "low",
      reason: "这类日常安排更适合作为可移动时间块，优先给更难改的事项让位。",
    };
  }

  return recurring
    ? {
        priority: 2,
        flexibilityLabel: "中等约束",
        flexibilityTone: "medium",
        reason: "虽然不是最硬的节点，但重复安排会影响整体节奏，适合放在中优先层。",
      }
    : {
        priority: 3,
        flexibilityLabel: "可灵活调整",
        flexibilityTone: "low",
        reason: "目前看更像普通弹性安排，可以根据更重要的事情再做调整。",
      };
}

export function scheduleItemWithPriority({
  items,
  incoming,
  previousItem,
  reason,
}: ScheduleEngineOptions): ScheduleMutationResult {
  const untouchedItems = items.filter((item) => item.id !== incoming.id);
  const sameDayItems = untouchedItems.filter((item) => item.date === incoming.date);
  const otherDayItems = untouchedItems.filter((item) => item.date !== incoming.date);
  const previousSnapshot = previousItem
    ? { date: previousItem.date, start: previousItem.start, end: previousItem.end }
    : undefined;

  const placement = placeIntoDay(
    sameDayItems,
    incoming,
    reason,
    previousSnapshot,
  );

  const nextItems = sortScheduleItems([...otherDayItems, ...placement.items]);
  const savedItem =
    nextItems.find((item) => item.id === incoming.id) ?? incoming;

  return {
    items: nextItems,
    alerts: placement.alerts,
    savedItem,
  };
}

export function resolveScheduleItemsForMonth(
  items: DailyScheduleItem[],
  viewedMonth: string,
) {
  const monthStart = new Date(`${viewedMonth}T00:00:00`);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const expanded = items.flatMap((item) =>
    expandItemForMonth(item, monthStart, monthEnd),
  );

  const grouped = new Map<string, DailyScheduleItem[]>();
  for (const item of expanded) {
    if (!grouped.has(item.date)) {
      grouped.set(item.date, []);
    }

    grouped.get(item.date)?.push(item);
  }

  const resolved: DailyScheduleItem[] = [];
  for (const [date, dayItems] of [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    resolved.push(...resolveDayItems(date, dayItems));
  }

  return sortScheduleItems(resolved);
}

function placeIntoDay(
  existingItems: DailyScheduleItem[],
  incoming: DailyScheduleItem,
  reason: ScheduleMutationReason,
  previousSnapshot?: PlacementSnapshot,
): DayPlacementResult {
  const duration = getDurationMinutes(incoming);
  const baseSnapshot = previousSnapshot ?? {
    date: incoming.date,
    start: incoming.start,
    end: incoming.end,
  };

  let candidate = { ...incoming };
  let dayItems = sortScheduleItems(existingItems);
  const alerts: RescheduleAlert[] = [];

  while (true) {
    const overlaps = dayItems.filter((item) => isOverlapping(item, candidate));

    if (overlaps.length === 0) {
      if (
        candidate.date !== baseSnapshot.date ||
        candidate.start !== baseSnapshot.start ||
        candidate.end !== baseSnapshot.end
      ) {
        candidate = withRescheduleMetadata(candidate, baseSnapshot, getShiftReason(reason));
        alerts.push(
          buildAlert({
            date: candidate.date,
            title: "日程已按优先级重排",
            detail: `${candidate.title} 与更高优先级安排冲突，系统已自动后移并保留该事项。`,
            impact: `新的时间为 ${candidate.start} - ${candidate.end}。原计划是 ${baseSnapshot.start} - ${baseSnapshot.end}。`,
          }),
        );
      } else {
        candidate = { ...candidate, status: "scheduled" };
      }

      return {
        items: sortScheduleItems([...dayItems, candidate]),
        alerts,
      };
    }

    const blockingItems = overlaps.filter((item) => item.priority <= candidate.priority);

    if (blockingItems.length > 0) {
      const nextStart = Math.max(...blockingItems.map((item) => toMinutes(item.end)));
      candidate = moveToStart(candidate, nextStart, duration);
      continue;
    }

    dayItems = dayItems.filter(
      (item) => !overlaps.some((conflict) => conflict.id === item.id),
    );
    dayItems = sortScheduleItems([...dayItems, candidate]);

    for (const conflict of overlaps.sort(compareByPriorityAndTime)) {
      const displacedSnapshot: PlacementSnapshot = {
        date: conflict.date,
        start: conflict.start,
        end: conflict.end,
      };
      const shiftedStart = Math.max(toMinutes(candidate.end), toMinutes(conflict.start));
      const shiftedItem = moveToStart(conflict, shiftedStart, getDurationMinutes(conflict));
      const nestedPlacement = placeIntoDay(
        dayItems.filter((item) => item.id !== conflict.id),
        shiftedItem,
        "update",
        displacedSnapshot,
      );
      const finalShiftedItem =
        nestedPlacement.items.find((item) => item.id === conflict.id) ?? shiftedItem;

      dayItems = nestedPlacement.items;
      alerts.push(
        buildAlert({
          date: conflict.date,
          title: "检测到冲突，已自动改期",
          detail: `${candidate.title} 优先级更高，系统保留当前安排并自动后移 ${conflict.title}。`,
          impact: `${conflict.title} 已从 ${displacedSnapshot.start} - ${displacedSnapshot.end} 调整到 ${finalShiftedItem.start} - ${finalShiftedItem.end}。`,
        }),
        ...nestedPlacement.alerts,
      );
    }

    return {
      items: sortScheduleItems(dayItems),
      alerts,
    };
  }
}

function resolveDayItems(_date: string, items: DailyScheduleItem[]) {
  const ordered = [...items].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    if ((left.generatedFromRecurring ?? false) !== (right.generatedFromRecurring ?? false)) {
      return (left.generatedFromRecurring ?? false) ? 1 : -1;
    }

    return left.start.localeCompare(right.start);
  });

  return ordered.reduce<DailyScheduleItem[]>((current, item) => {
    const placement = placeIntoDay(current, item, "create");
    return placement.items;
  }, []);
}

function expandItemForMonth(
  item: DailyScheduleItem,
  monthStart: Date,
  monthEnd: Date,
) {
  const recurrence = item.recurrence ?? "none";
  if (recurrence === "none") {
    return isDateInRange(item.date, monthStart, monthEnd) ? [item] : [];
  }

  const result: DailyScheduleItem[] = [];
  const baseDate = new Date(`${item.date}T00:00:00`);
  const cursor = new Date(baseDate);
  const effectiveEndDate = getEffectiveRecurrenceEndDate(item, monthEnd);
  const monthStartString = toDateString(monthStart);
  const monthEndString = toDateString(monthEnd);
  let occurrenceCount = 0;

  while (cursor <= effectiveEndDate) {
    const date = toDateString(cursor);
    if (
      matchesRecurrence(item, date)
    ) {
      occurrenceCount += 1;

      if (
        item.recurrenceEndType === "count" &&
        item.recurrenceCount &&
        occurrenceCount > item.recurrenceCount
      ) {
        break;
      }

      if (
        date >= monthStartString &&
        date <= monthEndString &&
        !(item.skippedDates ?? []).includes(date)
      ) {
        result.push({
          ...item,
          id: date === item.date ? item.id : `${item.id}::${date}`,
          date,
          seriesId: item.id,
          generatedFromRecurring: date !== item.date,
        });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

function getShiftReason(reason: ScheduleMutationReason) {
  if (reason === "suggestion") {
    return "加入建议后与既有安排冲突，系统按优先级自动后移。";
  }

  if (reason === "update") {
    return "编辑后与既有安排冲突，系统按优先级自动后移。";
  }

  return "新增后与既有安排冲突，系统按优先级自动后移。";
}

function withRescheduleMetadata(
  item: DailyScheduleItem,
  snapshot: PlacementSnapshot,
  reason: string,
): DailyScheduleItem {
  return {
    ...item,
    status: "rescheduled",
    rescheduledFrom: item.rescheduledFrom ?? {
      date: snapshot.date,
      start: snapshot.start,
      end: snapshot.end,
      reason,
    },
  };
}

function buildAlert({
  date,
  title,
  detail,
  impact,
}: {
  date: string;
  title: string;
  detail: string;
  impact: string;
}): RescheduleAlert {
  return {
    id: `alert-${date}-${Math.random().toString(36).slice(2, 10)}`,
    title,
    detail,
    date,
    impact,
  };
}

function getDurationMinutes(item: Pick<DailyScheduleItem, "start" | "end">) {
  return Math.max(30, toMinutes(item.end) - toMinutes(item.start));
}

function moveToStart(item: DailyScheduleItem, nextStart: number, duration: number) {
  return {
    ...item,
    start: toTime(nextStart),
    end: toTime(nextStart + duration),
  };
}

function isOverlapping(
  left: Pick<DailyScheduleItem, "start" | "end">,
  right: Pick<DailyScheduleItem, "start" | "end">,
) {
  const leftRange = getRange(left);
  const rightRange = getRange(right);

  return leftRange.start < rightRange.end && rightRange.start < leftRange.end;
}

function getRange(item: Pick<DailyScheduleItem, "start" | "end">): TimeRange {
  return {
    start: toMinutes(item.start),
    end: toMinutes(item.end),
  };
}

function compareByPriorityAndTime(left: DailyScheduleItem, right: DailyScheduleItem) {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  return left.start.localeCompare(right.start);
}

function isDateInRange(date: string, start: Date, end: Date) {
  const current = new Date(`${date}T00:00:00`);
  return current >= start && current <= end;
}

function matchesRecurrence(
  item: DailyScheduleItem,
  currentDate: string,
) {
  const baseDate = item.date;
  const recurrence = item.recurrence ?? "none";

  if (currentDate < baseDate) {
    return false;
  }

  if (recurrence === "daily") {
    return true;
  }

  const base = new Date(`${baseDate}T00:00:00`);
  const current = new Date(`${currentDate}T00:00:00`);

  if (recurrence === "weekly") {
    const weekdays = item.recurrenceWeekdays?.length
      ? item.recurrenceWeekdays
      : [toWeekdayIndex(base)];
    return weekdays.includes(toWeekdayIndex(current));
  }

  if (recurrence === "monthly") {
    const monthDay = item.recurrenceMonthDay ?? base.getDate();
    return current.getDate() === monthDay;
  }

  if (recurrence === "yearly") {
    return (
      base.getMonth() === current.getMonth() &&
      base.getDate() === current.getDate()
    );
  }

  return currentDate === baseDate;
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes: number) {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function toDateString(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}`;
}

function getEffectiveRecurrenceEndDate(item: DailyScheduleItem, monthEnd: Date) {
  if (
    item.recurrenceEndType === "until" &&
    item.recurrenceEndsOn &&
    item.recurrenceEndsOn < toDateString(monthEnd)
  ) {
    return new Date(`${item.recurrenceEndsOn}T00:00:00`);
  }

  return monthEnd;
}

function toWeekdayIndex(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}
