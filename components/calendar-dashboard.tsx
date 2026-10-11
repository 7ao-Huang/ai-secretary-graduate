"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useEffect, useMemo, useRef, useState } from "react";

import { Badge, SectionCard } from "@/components/section-card";
import {
  explainSchedulePriority,
  inferSchedulePriority,
  resolveScheduleItemsForMonth,
  scheduleItemWithPriority,
  sortScheduleItems,
} from "@/lib/schedule-engine";
import {
  alerts,
  assistantMetrics,
  categoryColorMap,
  dailySchedule,
  quickAddPresets,
  suggestions,
  type DailyScheduleItem,
  type EventCategory,
  type RescheduleAlert,
  type ScheduleRecurrence,
  type ScheduleRecurrenceEndType,
  shouldShowInMonth,
} from "@/lib/secretary-data";
import {
  buildRecentEmailChangeHomeHref,
  buildRecentEmailChanges,
  buildTaskCenterHref,
  createStableId,
  EMAIL_CONNECTION_STORAGE_KEY,
  EMAIL_CONNECTIONS_UPDATED_EVENT,
  HOME_DASHBOARD_STORAGE_KEY,
  getPersistedEmailConnections,
  mergeEmailIntoDashboardState,
  parseHomeDashboardIntent,
  seedDemoDataIfEmpty,
  type PersistedDashboardState,
  type RecentEmailChange,
} from "@/lib/workspace-sync";

type QuickAddForm = {
  title: string;
  note: string;
  date: string;
  start: string;
  end: string;
  category: EventCategory;
  showInMonth: boolean;
  recurrence: ScheduleRecurrence;
  recurrenceEndType: ScheduleRecurrenceEndType;
  recurrenceEndsOn: string;
  recurrenceCount: string;
  recurrenceWeekdays: number[];
  recurrenceMonthDay: string;
};

type EditScope = "create" | "series" | "single";
type NaturalLanguageDraft = {
  mode: "schedule" | "record";
  title: string;
  note: string;
  date: string;
  start: string;
  end: string;
  timeUnknown?: boolean;
  endTimeInferred?: boolean;
  showInMonth: boolean;
};

type NaturalLanguageParseResult = {
  items: NaturalLanguageDraft[];
  message: string;
  focusDate: string;
  preferredView: "month" | "day";
  hasSchedule: boolean;
  hasRecord: boolean;
};

const todayFocus = {
  label: "秘书建议",
  value: "月历看重要事件，当日流程看完整安排",
  hint: "像健身这类日常习惯不挤占月视图，只在当日流程里展示。",
};

const weekdayOptions = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 7, label: "周日" },
];

export function CalendarDashboard() {
  const router = useRouter();
  const todayDate = getTodayDate();
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [viewedMonth, setViewedMonth] = useState(getMonthStart(todayDate));
  const [secretaryInsightMode, setSecretaryInsightMode] = useState<"week" | "month">(
    "week",
  );
  const [scheduleItems, setScheduleItems] =
    useState<DailyScheduleItem[]>(sortScheduleItems(dailySchedule));
  const [acceptedSuggestionIds, setAcceptedSuggestionIds] = useState<string[]>([]);
  const [alertItems, setAlertItems] = useState<RescheduleAlert[]>(alerts);
  const [form, setForm] = useState<QuickAddForm>(createDefaultForm(todayDate));
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingScope, setEditingScope] = useState<EditScope>("create");
  const [editingOccurrenceDate, setEditingOccurrenceDate] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [topViewMode, setTopViewMode] = useState<"month" | "day">("month");
  const [topViewAnimateIn, setTopViewAnimateIn] = useState(true);
  const [naturalLanguageInput, setNaturalLanguageInput] = useState("");
  const [naturalLanguageError, setNaturalLanguageError] = useState("");
  const [naturalLanguageFeedback, setNaturalLanguageFeedback] = useState("");
  const [naturalLanguagePreview, setNaturalLanguagePreview] =
    useState<NaturalLanguageParseResult | null>(null);
  const [focusedScheduleItemId, setFocusedScheduleItemId] = useState<string | null>(null);
  const [focusedAlertId, setFocusedAlertId] = useState<string | null>(null);
  const [focusedRecentChangeId, setFocusedRecentChangeId] = useState<string | null>(null);
  const [emailChangesVersion, setEmailChangesVersion] = useState(0);
  const topViewContainerRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedTopViewRef = useRef(false);

  const expandedScheduleItems = useMemo(
    () => resolveScheduleItemsForMonth(scheduleItems, viewedMonth),
    [scheduleItems, viewedMonth],
  );
  const recentEmailChanges = useMemo(
    () => buildRecentEmailChanges(getPersistedEmailConnections()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emailChangesVersion, scheduleItems, alertItems],
  );
  const inferredCategory = useMemo(
    () => inferEventCategoryFromText(form.title, form.note, form.category),
    [form.category, form.note, form.title],
  );
  const inferredPriorityPreview = useMemo(
    () =>
      inferSchedulePriority({
        title: form.title || "未命名行程",
        category: inferredCategory,
        source: "手动添加",
        note: form.note,
        showInMonth:
          inferredCategory === "学习" || inferredCategory === "健身" ? false : form.showInMonth,
        recurrence: form.recurrence,
      }),
    [form.note, form.recurrence, form.showInMonth, form.title, inferredCategory],
  );

  useEffect(() => {
    seedDemoDataIfEmpty(todayDate);

    const nextSelectedDate = todayDate;
    const nextViewedMonth = getMonthStart(todayDate);
    let nextSecretariatMode: "week" | "month" = "week";
    let nextScheduleItems = sortScheduleItems(dailySchedule);
    let nextAcceptedSuggestionIds: string[] = [];
    let nextAlertItems = alerts;
    const nextEmailAccounts = getPersistedEmailConnections();

    try {
      const raw = window.localStorage.getItem(HOME_DASHBOARD_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedDashboardState>;

        nextSecretariatMode = parsed.secretaryInsightMode ?? "week";
        nextScheduleItems = sortScheduleItems(parsed.scheduleItems ?? dailySchedule);
        nextAcceptedSuggestionIds = parsed.acceptedSuggestionIds ?? [];
        nextAlertItems = parsed.alertItems ?? alerts;
      }
    } catch {
    }

    const mergedEmailState = mergeEmailIntoDashboardState({
      scheduleItems: nextScheduleItems,
      alertItems: nextAlertItems,
      accounts: nextEmailAccounts,
    });
    nextScheduleItems = sortScheduleItems(mergedEmailState.scheduleItems);
    nextAlertItems = mergedEmailState.alertItems;

    queueMicrotask(() => {
      setSelectedDate(nextSelectedDate);
      setViewedMonth(nextViewedMonth);
      setSecretaryInsightMode(nextSecretariatMode);
      setScheduleItems(nextScheduleItems);
      setAcceptedSuggestionIds(nextAcceptedSuggestionIds);
      setAlertItems(nextAlertItems);
      setIsHydrated(true);
    });
  }, [todayDate]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const rawSearch = typeof window !== "undefined" ? window.location.search : null;
    const intent = parseHomeDashboardIntent(rawSearch, { date: todayDate });
    const urlParams = new URLSearchParams(rawSearch?.replace(/^\?/, "") ?? "");
    const changeId = urlParams.get("changeId");
    const focusTargetId = urlParams.get("focusId");

    releaseActiveElementFocus();

    window.requestAnimationFrame(() => {
      if (intent.mode === "day") {
        setSelectedDate(intent.date);
        setViewedMonth(getMonthStart(intent.date));
        setTopViewMode("day");
        if (changeId) {
          setFocusedRecentChangeId(changeId);
        }
        if (focusTargetId) {
          setFocusedScheduleItemId(focusTargetId);
          window.setTimeout(() => setFocusedScheduleItemId(null), 2800);
        }
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
        return;
      }

      if (intent.mode === "alerts") {
        setSelectedDate(intent.date);
        setViewedMonth(getMonthStart(intent.date));
        setTopViewMode("month");
        if (changeId) {
          setFocusedRecentChangeId(changeId);
        }
        if (focusTargetId) {
          setFocusedAlertId(focusTargetId);
          window.setTimeout(() => setFocusedAlertId(null), 2800);
        }
        window.requestAnimationFrame(() => {
          const element = document.getElementById("home-alerts-section");
          element?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        return;
      }

      if (changeId) {
        setFocusedRecentChangeId(changeId);
      }
      setTopViewMode("month");
    });
  }, [isHydrated, todayDate]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const params = new URLSearchParams(window.location.search.replace(/^\?/, ""));
    params.set("date", selectedDate);
    if (topViewMode === "day") {
      params.set("view", "day");
    } else {
      params.delete("view");
      params.delete("focus");
    }

    const query = params.toString();
    const nextUrl = query ? `/?${query}` : "/";
    if (nextUrl !== `${window.location.pathname}${window.location.search}`) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [isHydrated, selectedDate, topViewMode, router]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const payload: PersistedDashboardState = {
      selectedDate,
      viewedMonth,
      secretaryInsightMode,
      scheduleItems,
      acceptedSuggestionIds,
      alertItems,
    };

    window.localStorage.setItem(HOME_DASHBOARD_STORAGE_KEY, JSON.stringify(payload));
  }, [
    acceptedSuggestionIds,
    alertItems,
    isHydrated,
    scheduleItems,
    secretaryInsightMode,
    selectedDate,
    viewedMonth,
  ]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const refreshFromEmailSync = () => {
      const accounts = getPersistedEmailConnections();
      const mergedEmailState = mergeEmailIntoDashboardState({
        scheduleItems,
        alertItems,
        accounts,
      });

      setScheduleItems(sortScheduleItems(mergedEmailState.scheduleItems));
      setAlertItems(mergedEmailState.alertItems);
      setEmailChangesVersion((version) => version + 1);
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
  }, [alertItems, isHydrated, scheduleItems]);

  useEffect(() => {
    if (!hasInitializedTopViewRef.current) {
      hasInitializedTopViewRef.current = true;
      return;
    }

    setTopViewAnimateIn(false);

    const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animationTimer = window.setTimeout(() => {
      setTopViewAnimateIn(true);
    }, shouldReduceMotion ? 0 : 18);

    const scrollFrame = window.requestAnimationFrame(() => {
      const top = topViewContainerRef.current?.getBoundingClientRect().top;
      if (top === undefined) {
        return;
      }

      const targetTop = Math.max(0, window.scrollY + top - 12);
      if (Math.abs(window.scrollY - targetTop) > 6) {
        window.scrollTo({
          top: targetTop,
          behavior: shouldReduceMotion ? "auto" : "smooth",
        });
      }
    });

    return () => {
      window.clearTimeout(animationTimer);
      window.cancelAnimationFrame(scrollFrame);
    };
  }, [topViewMode]);

  const selectedDayItems = useMemo(
    () =>
      expandedScheduleItems
        .filter((item) => item.date === selectedDate)
        .sort((a, b) => a.start.localeCompare(b.start)),
    [expandedScheduleItems, selectedDate],
  );

  const calendarEvents = useMemo(() => {
    return expandedScheduleItems
      .filter((item) => shouldShowInMonth(item))
      .map((item) => ({
        id: item.id,
        date: item.date,
        title: item.title,
        category: item.category,
        priority: item.priority,
        time: item.timeUnknown ? "" : item.start,
      }));
  }, [expandedScheduleItems]);

  const monthDays = useMemo(() => {
    const monthDate = new Date(`${viewedMonth}T00:00:00`);
    const year = monthDate.getFullYear();
    const monthIndex = monthDate.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDayJs = new Date(year, monthIndex, 1).getDay();
    const offset = firstDayJs === 0 ? 6 : firstDayJs - 1;

    const cells: Array<{
      key: string;
      date: string | null;
      dayNumber: number | null;
      events: typeof calendarEvents;
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
      const date = formatDate(year, monthIndex, day);
      cells.push({
        key: date,
        date,
        dayNumber: day,
        events: calendarEvents.filter((item) => item.date === date),
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
  }, [calendarEvents, viewedMonth]);

  const monthLabel = formatMonthLabel(viewedMonth);
  const canGoBack = true;
  const canGoForward = true;
  const secretaryInsight = useMemo(
    () =>
      secretaryInsightMode === "week"
        ? getWeekSecretaryInsight(selectedDate, expandedScheduleItems, suggestions)
        : getMonthSecretaryInsight(viewedMonth, expandedScheduleItems, suggestions),
    [expandedScheduleItems, secretaryInsightMode, selectedDate, viewedMonth],
  );

  const selectedDayAlerts = alertItems.filter((item) => item.date === selectedDate);

  const dynamicMetrics = [
    {
      ...assistantMetrics[0],
      value: String(calendarEvents.length),
    },
    {
      ...assistantMetrics[1],
      value: String(expandedScheduleItems.filter((item) => item.status === "rescheduled").length),
    },
    {
      ...assistantMetrics[2],
      value: String(suggestions.length - acceptedSuggestionIds.length),
    },
    {
      ...assistantMetrics[3],
      value: String(selectedDayAlerts.length),
    },
  ];

  function handleQuickAddSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      setFormError("请先填写行程名称。");
      return;
    }

    if (form.end <= form.start) {
      setFormError("结束时间需要晚于开始时间。");
      return;
    }

    const recurrenceCount = Number(form.recurrenceCount);
    const recurrenceMonthDay = Number(form.recurrenceMonthDay);
    const recurrenceWeekdays = uniqueWeekdayIndexes(form.recurrenceWeekdays);

    if (form.recurrence === "weekly" && recurrenceWeekdays.length === 0) {
      setFormError("周重复至少要选择一个重复日。");
      return;
    }

    if (
      form.recurrence === "monthly" &&
      (!Number.isInteger(recurrenceMonthDay) || recurrenceMonthDay < 1 || recurrenceMonthDay > 31)
    ) {
      setFormError("每月重复的日期需要填写 1 到 31 之间的数字。");
      return;
    }

    if (form.recurrence !== "none" && form.recurrenceEndType === "until" && !form.recurrenceEndsOn) {
      setFormError("请选择重复结束日期。");
      return;
    }

    if (
      form.recurrence !== "none" &&
      form.recurrenceEndType === "until" &&
      form.recurrenceEndsOn < form.date
    ) {
      setFormError("结束日期不能早于开始日期。");
      return;
    }

    if (
      form.recurrence !== "none" &&
      form.recurrenceEndType === "count" &&
      (!Number.isInteger(recurrenceCount) || recurrenceCount < 1)
    ) {
      setFormError("重复次数至少要填写 1 次。");
      return;
    }

    setFormError("");

    const existingItem = editingItemId
      ? scheduleItems.find((item) => item.id === editingItemId)
      : undefined;
    const shouldPinToMonth =
      inferredCategory === "学习" || inferredCategory === "健身" ? false : form.showInMonth;
    const inferredPriority = inferSchedulePriority({
      title: form.title.trim(),
      category: inferredCategory,
      source: existingItem?.source ?? "手动添加",
      note: form.note.trim(),
      showInMonth: shouldPinToMonth,
      recurrence: form.recurrence,
    });
    const nextItem: DailyScheduleItem = {
      id: editingItemId ?? `manual-${Date.now()}`,
      date: form.date,
      title: form.title.trim(),
      category: inferredCategory,
      start: form.start,
      end: form.end,
      priority: inferredPriority,
      source: existingItem?.source ?? "手动添加",
      note:
        form.note.trim() ||
        "由你在首页维护，后续会参与冲突检测、自动重排和提醒。",
      showInMonth: shouldPinToMonth,
      status: "scheduled",
      recurrence: form.recurrence,
      recurrenceEndType: form.recurrence === "none" ? undefined : form.recurrenceEndType,
      recurrenceEndsOn:
        form.recurrence !== "none" && form.recurrenceEndType === "until"
          ? form.recurrenceEndsOn
          : undefined,
      recurrenceCount:
        form.recurrence !== "none" && form.recurrenceEndType === "count"
          ? recurrenceCount
          : undefined,
      recurrenceWeekdays: form.recurrence === "weekly" ? recurrenceWeekdays : undefined,
      recurrenceMonthDay: form.recurrence === "monthly" ? recurrenceMonthDay : undefined,
      isRecurring:
        form.recurrence !== "none" ||
        existingItem?.isRecurring ||
        form.category === "学习" ||
        form.category === "健身",
      rescheduledFrom: existingItem?.rescheduledFrom,
    };

    if (editingScope === "single" && existingItem && editingOccurrenceDate) {
      const seriesItem = existingItem.detachedFromSeries
        ? scheduleItems.find((item) => item.id === existingItem.id)
        : scheduleItems.find((item) => item.id === (existingItem.seriesId ?? existingItem.id));

      if (existingItem.detachedFromSeries) {
        const result = scheduleItemWithPriority({
          items: scheduleItems,
          incoming: {
            ...nextItem,
            recurrence: "none",
            detachedFromSeries: true,
            exceptionForDate: existingItem.exceptionForDate ?? editingOccurrenceDate,
            seriesId: existingItem.seriesId,
            isRecurring: false,
          },
          previousItem: existingItem,
          reason: "update",
        });

        setScheduleItems(result.items);
        setAlertItems((current) =>
          mergeAlerts(current, [
            buildInfoAlert(
              result.savedItem.date,
              "本次重复行程已单独修改",
              `${result.savedItem.title} 仅修改这一次，不会影响整个系列。`,
            ),
            ...result.alerts,
          ]),
        );
        setSelectedDate(result.savedItem.date);
        setViewedMonth(getMonthStart(result.savedItem.date));
        resetForm(result.savedItem.date);
        setIsQuickAddOpen(false);
        return;
      }

      if (seriesItem) {
        const skippedDates = uniqueDates([
          ...(seriesItem.skippedDates ?? []),
          editingOccurrenceDate,
        ]);
        const updatedSeries = {
          ...seriesItem,
          skippedDates,
        };
        const overrideId = `${seriesItem.id}::override::${editingOccurrenceDate}`;
        const existingOverride = scheduleItems.find((item) => item.id === overrideId);
        const seriesItems = scheduleItems.filter(
          (item) => item.id !== seriesItem.id && item.id !== overrideId,
        );
        const result = scheduleItemWithPriority({
          items: [...seriesItems, updatedSeries],
          incoming: {
            ...nextItem,
            id: overrideId,
            date: editingOccurrenceDate,
            recurrence: "none",
            isRecurring: false,
            seriesId: seriesItem.id,
            detachedFromSeries: true,
            exceptionForDate: editingOccurrenceDate,
            generatedFromRecurring: false,
          },
          previousItem: existingOverride,
          reason: "update",
        });

        setScheduleItems(result.items);
        setAlertItems((current) =>
          mergeAlerts(current, [
            buildInfoAlert(
              editingOccurrenceDate,
              "本次重复行程已单独修改",
              `${nextItem.title} 这一次已单独调整，整个系列保持不变。`,
            ),
            ...result.alerts,
          ]),
        );
        setSelectedDate(editingOccurrenceDate);
        setViewedMonth(getMonthStart(editingOccurrenceDate));
        resetForm(editingOccurrenceDate);
        setIsQuickAddOpen(false);
        return;
      }
    }

    const result = scheduleItemWithPriority({
      items: scheduleItems,
      incoming: nextItem,
      previousItem: existingItem,
      reason: existingItem ? "update" : "create",
    });

    setScheduleItems(result.items);
    setAlertItems((current) =>
      mergeAlerts(
        current,
        result.alerts.length > 0
          ? result.alerts
          : [
              buildInfoAlert(
                result.savedItem.date,
                existingItem ? "日程已更新" : "新行程已加入",
                existingItem
                  ? `${result.savedItem.title} 已保存到日程中。`
                  : `${result.savedItem.title} 已加入日程并开始参与自动排程。AI 已判断为 ${getPriorityLabel(
                      inferredPriority,
                    )}。${getRecurrenceNotice(form)}`,
              ),
            ],
      ),
    );
    setSelectedDate(result.savedItem.date);
    setViewedMonth(getMonthStart(result.savedItem.date));
    resetForm(result.savedItem.date);
    setIsQuickAddOpen(false);
  }

  function acceptSuggestion(suggestionId: string) {
    if (acceptedSuggestionIds.includes(suggestionId)) {
      return;
    }

    const suggestion = suggestions.find((item) => item.id === suggestionId);
    if (!suggestion) {
      return;
    }

    const [date, timeRange] = suggestion.scheduleAt.split(" ");
    const [start, end] = timeRange.split("-");

    const item: DailyScheduleItem = {
      id: `suggestion-${suggestion.id}`,
      date,
      title: suggestion.title,
      category: suggestion.type === "线下活动" ? "活动" : "学习",
      start,
      end,
      priority: inferSchedulePriority({
        title: suggestion.title,
        category: suggestion.type === "线下活动" ? "活动" : "学习",
        source: "AI建议",
        note: suggestion.detail ?? suggestion.summary,
        showInMonth: suggestion.type === "线下活动",
        recurrence: "none",
      }),
      source: "AI建议",
      note: suggestion.detail ?? suggestion.summary,
      showInMonth: suggestion.type === "线下活动",
      status: "scheduled",
      recurrence: "none",
      isRecurring: suggestion.type !== "线下活动",
    };

    const result = scheduleItemWithPriority({
      items: scheduleItems,
      incoming: item,
      reason: "suggestion",
    });

    setScheduleItems(result.items);
    setAcceptedSuggestionIds((current) => [...current, suggestionId]);
    setAlertItems((current) =>
      mergeAlerts(current, [
        buildInfoAlert(date, "AI 建议已加入日程", `${suggestion.title} 已进入你的计划中。`),
        ...result.alerts,
      ]),
    );
    setSelectedDate(result.savedItem.date);
    setViewedMonth(getMonthStart(result.savedItem.date));
  }

  const selectedDaySummary =
    monthDays.find((item) => item.date === selectedDate)?.events ?? [];

  function startEditing(item: DailyScheduleItem) {
    if (item.detachedFromSeries) {
      setEditingItemId(item.id);
      setEditingScope("single");
      setEditingOccurrenceDate(item.exceptionForDate ?? item.date);
      setFormError("");
      setSelectedDate(item.date);
      setViewedMonth(getMonthStart(item.date));
      setForm(buildFormFromItem(item, true));
      setIsQuickAddOpen(true);
      return;
    }

    const sourceId = item.seriesId ?? item.id;
    const sourceItem =
      scheduleItems.find((scheduleItem) => scheduleItem.id === sourceId) ?? item;
    setEditingItemId(sourceItem.id);
    setEditingScope(item.detachedFromSeries ? "single" : "series");
    setEditingOccurrenceDate(item.detachedFromSeries ? item.exceptionForDate ?? item.date : null);
    setFormError("");
    setSelectedDate(item.date);
    setViewedMonth(getMonthStart(item.date));
    setForm(buildFormFromItem(sourceItem));
    setIsQuickAddOpen(true);
  }

  function startEditingSingleOccurrence(item: DailyScheduleItem) {
    const sourceId = item.seriesId ?? item.id;
    const sourceItem =
      scheduleItems.find((scheduleItem) => scheduleItem.id === sourceId) ?? item;
    setEditingItemId(sourceItem.id);
    setEditingScope("single");
    setEditingOccurrenceDate(item.exceptionForDate ?? item.date);
    setFormError("");
    setSelectedDate(item.date);
    setViewedMonth(getMonthStart(item.date));
    setForm(buildFormFromItem(item, true));
    setIsQuickAddOpen(true);
  }

  function startEditingSeries(item: DailyScheduleItem) {
    const sourceId = item.seriesId ?? item.id;
    const sourceItem =
      scheduleItems.find((scheduleItem) => scheduleItem.id === sourceId) ?? item;
    setEditingItemId(sourceItem.id);
    setEditingScope("series");
    setEditingOccurrenceDate(null);
    setFormError("");
    setSelectedDate(item.date);
    setViewedMonth(getMonthStart(item.date));
    setForm(buildFormFromItem(sourceItem));
    setIsQuickAddOpen(true);
  }

  function handleDelete(item: DailyScheduleItem) {
    const targetId = item.detachedFromSeries ? item.id : item.seriesId ?? item.id;
    setScheduleItems((current) => current.filter((currentItem) => currentItem.id !== targetId));
    setAlertItems((current) =>
      mergeAlerts(current, [
        buildInfoAlert(item.date, "行程已删除", `${item.title} 已从你的日程中移除。`),
      ]),
    );
    if (item.id.startsWith("suggestion-")) {
      const suggestionId = item.id.replace("suggestion-", "");
      setAcceptedSuggestionIds((current) => current.filter((id) => id !== suggestionId));
    }
    if (editingItemId === targetId) {
      resetForm(item.date);
    }
  }

  function resetForm(date = selectedDate) {
    setEditingItemId(null);
    setEditingScope("create");
    setEditingOccurrenceDate(null);
    setFormError("");
    setForm(createDefaultForm(date));
  }

  function changeMonth(direction: -1 | 1) {
    const nextMonth = shiftMonth(viewedMonth, direction);
    setViewedMonth(nextMonth);
    setSelectedDate(getDefaultDateForMonth(nextMonth));
    if (editingItemId) {
      resetForm(getDefaultDateForMonth(nextMonth));
    }
  }

  function jumpToToday() {
    setViewedMonth(getMonthStart(todayDate));
    setSelectedDate(todayDate);
    if (editingItemId) {
      resetForm(todayDate);
    }
  }

  function openQuickAddModal(date = selectedDate) {
    resetForm(date);
    setIsQuickAddOpen(true);
  }

  function openDayFlow(date: string) {
    releaseActiveElementFocus();
    setSelectedDate(date);
    setTopViewMode("day");
  }

  function handleRecentEmailChangeAction(change: RecentEmailChange) {
    if (change.target.kind === "task-center") {
      return;
    }

    setFocusedRecentChangeId(change.id);
    window.setTimeout(() => {
      if (focusedRecentChangeId === change.id) {
        setFocusedRecentChangeId(null);
      }
    }, 2800);

    if (change.target.kind === "alert-section") {
      const date = change.target.date ?? selectedDate;
      releaseActiveElementFocus();
      setTopViewMode("month");
      setSelectedDate(date);
      const alertMatch = alertItems.find(
        (item) =>
          item.date === date &&
          (item.title.includes(change.title) || change.title.includes(item.title)),
      );
      if (alertMatch) {
        setFocusedAlertId(alertMatch.id);
        window.setTimeout(() => setFocusedAlertId(null), 2800);
      }
      window.requestAnimationFrame(() => {
        const element = document.getElementById("home-alerts-section");
        element?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    if (change.target.kind === "day-flow") {
      openDayFlow(change.target.date);
      const dayDate = change.target.date;
      const scheduleMatch = scheduleItems.find(
        (item) =>
          item.date === dayDate &&
          (item.title.includes(change.title) || change.title.includes(item.title)),
      );
      if (scheduleMatch) {
        setFocusedScheduleItemId(scheduleMatch.id);
        window.setTimeout(() => setFocusedScheduleItemId(null), 2800);
      }
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  function returnToMonthView() {
    releaseActiveElementFocus();
    setTopViewMode("month");
  }

  function handleNaturalLanguageSubmit() {
    const rawText = naturalLanguageInput.trim();
    if (!rawText) {
      setNaturalLanguageError("先输入一句话，我再帮你识别。");
      setNaturalLanguageFeedback("");
      setNaturalLanguagePreview(null);
      return;
    }

    const parsed = parseNaturalLanguageInput(rawText, todayDate, selectedDate);
    if (!parsed || parsed.items.length === 0) {
      setNaturalLanguageError("我暂时没识别出可加入的内容，你可以把时间或活动写得再明确一点。");
      setNaturalLanguageFeedback("");
      setNaturalLanguagePreview(null);
      return;
    }

    setNaturalLanguageError("");
    setNaturalLanguageFeedback("");
    setNaturalLanguagePreview(parsed);
  }

  function confirmNaturalLanguagePreview() {
    if (!naturalLanguagePreview) {
      return;
    }

    let nextItems = scheduleItems;
    const resultAlerts: RescheduleAlert[] = [];
    let latestSavedDate = naturalLanguagePreview.focusDate;

    naturalLanguagePreview.items.forEach((draft, index) => {
      const category = inferEventCategoryFromText(draft.title, draft.note);
      const priority = inferSchedulePriority({
        title: draft.title,
        category,
        source: "手动添加",
        note: draft.note,
        showInMonth: draft.showInMonth,
        recurrence: "none",
      });

      const result = scheduleItemWithPriority({
        items: nextItems,
        incoming: {
          id: `nl-${Date.now()}-${index}`,
          date: draft.date,
          title: draft.title,
          category,
          start: draft.start,
          end: draft.end,
          timeUnknown: draft.timeUnknown,
          endTimeInferred: draft.endTimeInferred,
          priority,
          source: "手动添加",
          note: draft.note,
          showInMonth: draft.showInMonth,
          status: "scheduled",
          recurrence: "none",
          isRecurring: false,
        },
        reason: "create",
      });

      nextItems = result.items;
      latestSavedDate = result.savedItem.date;
      resultAlerts.push(...result.alerts);
    });

    setScheduleItems(nextItems);
    setAlertItems((current) =>
      mergeAlerts(current, [
        buildInfoAlert(
          latestSavedDate,
          naturalLanguagePreview.hasSchedule && !naturalLanguagePreview.hasRecord
            ? "已识别并加入行程"
            : naturalLanguagePreview.hasRecord && !naturalLanguagePreview.hasSchedule
              ? "已记录日常活动"
              : "已写入识别内容",
          naturalLanguagePreview.message,
        ),
        ...resultAlerts,
      ]),
    );
    setSelectedDate(latestSavedDate);
    setViewedMonth(getMonthStart(latestSavedDate));
    setTopViewMode(naturalLanguagePreview.preferredView);
    setNaturalLanguageFeedback(naturalLanguagePreview.message);
    setNaturalLanguageInput("");
    setNaturalLanguagePreview(null);
  }

  function cancelNaturalLanguagePreview() {
    setNaturalLanguagePreview(null);
  }

  function skipOccurrence(item: DailyScheduleItem) {
    if (item.detachedFromSeries) {
      handleDelete(item);
      return;
    }

    const sourceId = item.seriesId ?? item.id;
    const seriesItem = scheduleItems.find((scheduleItem) => scheduleItem.id === sourceId);
    if (!seriesItem) {
      return;
    }

    const skippedDates = uniqueDates([...(seriesItem.skippedDates ?? []), item.date]);
    const nextItems = scheduleItems
      .filter(
        (currentItem) =>
          !(
            currentItem.detachedFromSeries &&
            currentItem.seriesId === sourceId &&
            (currentItem.exceptionForDate ?? currentItem.date) === item.date
          ),
      )
      .map((currentItem) =>
        currentItem.id === sourceId ? { ...currentItem, skippedDates } : currentItem,
      );

    setScheduleItems(nextItems);
    setAlertItems((current) =>
      mergeAlerts(current, [
        buildInfoAlert(item.date, "本次重复已跳过", `${item.title} 这一次不会再出现在日程里。`),
      ]),
    );
    if (editingItemId === sourceId) {
      resetForm(item.date);
    }
  }

  function pauseRecurringForWeek(item: DailyScheduleItem) {
    const sourceId = item.seriesId ?? item.id;
    const seriesItem = scheduleItems.find((scheduleItem) => scheduleItem.id === sourceId);
    if (!seriesItem) {
      return;
    }

    const weekDates = getWeekDates(item.date).filter((date) =>
      shouldSkipDateForSeries(seriesItem, date),
    );
    const skippedDates = uniqueDates([...(seriesItem.skippedDates ?? []), ...weekDates]);
    const nextItems = scheduleItems
      .filter(
        (currentItem) =>
          !(
            currentItem.detachedFromSeries &&
            currentItem.seriesId === sourceId &&
            weekDates.includes(currentItem.exceptionForDate ?? currentItem.date)
          ),
      )
      .map((currentItem) =>
        currentItem.id === sourceId ? { ...currentItem, skippedDates } : currentItem,
      );

    setScheduleItems(nextItems);
    setAlertItems((current) =>
      mergeAlerts(current, [
        buildInfoAlert(
          item.date,
          "本周重复已暂停",
          `${item.title} 在本周内的重复安排已临时暂停，下周会按原规则恢复。`,
        ),
      ]),
    );
    if (editingItemId === sourceId) {
      resetForm(item.date);
    }
  }

  return (
    <div className="space-y-6">
      <div ref={topViewContainerRef}>
        <div
          className={`${topViewMode === "month" ? "block" : "hidden"} transition-all duration-300 ease-out ${
            topViewAnimateIn ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          <SectionCard
            title={`月历视图 · ${monthLabel}`}
          >
          <div className="mb-5 space-y-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                value={naturalLanguageInput}
                onChange={(event) => {
                  setNaturalLanguageInput(event.target.value);
                  setNaturalLanguagePreview(null);
                  setNaturalLanguageError("");
                }}
                placeholder="直接输入一句话，例如：今天下午两点去打两小时麻将；昨天去打了篮球，晚上和朋友做饭开party了"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300"
              />
              <button
                type="button"
                onClick={handleNaturalLanguageSubmit}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                智能识别
              </button>
            </div>
            {naturalLanguageError ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {naturalLanguageError}
              </div>
            ) : null}
            {naturalLanguageFeedback ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {naturalLanguageFeedback}
              </div>
            ) : null}
            {naturalLanguagePreview ? (
              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/90 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">识别预览</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {naturalLanguagePreview.message}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {naturalLanguagePreview.hasSchedule ? <Badge tone="medium">包含未来计划</Badge> : null}
                    {naturalLanguagePreview.hasRecord ? <Badge tone="low">包含过去记录</Badge> : null}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {naturalLanguagePreview.items.map((item, index) => {
                    const previewCategory = inferEventCategoryFromText(item.title, item.note);
                    const priorityExplanation =
                      item.mode === "schedule"
                        ? explainSchedulePriority({
                            title: item.title,
                            category: previewCategory,
                            source: "手动添加",
                            note: item.note,
                            showInMonth: item.showInMonth,
                            recurrence: "none",
                          })
                        : null;

                    return (
                      <div
                        key={`${item.mode}-${item.date}-${item.title}-${index}`}
                        className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-700"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={item.mode === "schedule" ? "medium" : "low"}>
                            {item.mode === "schedule" ? "计划" : "记录"}
                          </Badge>
                          <span>{formatDisplayDate(item.date)}</span>
                          <span className="text-slate-400">·</span>
                          <span>{item.title}</span>
                          <span className="text-slate-400">·</span>
                          <span>
                            {item.timeUnknown
                              ? "不写具体时间"
                              : item.endTimeInferred
                                ? item.start
                                : `${item.start}-${item.end}`}
                          </span>
                          {priorityExplanation ? (
                            <>
                              <span className="text-slate-300">·</span>
                              <Badge tone={priorityExplanation.flexibilityTone}>
                                {priorityExplanation.flexibilityLabel}
                              </Badge>
                            </>
                          ) : null}
                        </div>
                        {priorityExplanation ? (
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            AI判定：{getPriorityLabel(priorityExplanation.priority)}，{priorityExplanation.reason}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            这是已发生的日常记录，会按当天顺序收纳进当日流程，不参与高优先级抢占。
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={confirmNaturalLanguagePreview}
                    className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    确认写入
                  </button>
                  <button
                    type="button"
                    onClick={cancelNaturalLanguagePreview}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-violet-200 hover:text-violet-700"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!canGoBack}
                  onClick={() => changeMonth(-1)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  上个月
                </button>
                <div className="min-w-28 rounded-2xl bg-slate-100 px-4 py-2 text-center text-sm font-medium text-slate-700">
                  {monthLabel}
                </div>
                <button
                  type="button"
                  onClick={jumpToToday}
                  className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100"
                >
                  今天
                </button>
                <button
                  type="button"
                  disabled={!canGoForward}
                  onClick={() => changeMonth(1)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  下个月
                </button>
              </div>
              <button
                type="button"
                onClick={() => openQuickAddModal(selectedDate)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-2xl leading-none text-violet-700 transition hover:bg-violet-100"
                aria-label="快速添加新行程"
              >
                +
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {["一", "二", "三", "四", "五", "六", "日"].map((label) => (
              <div
                key={label}
                className="px-1 pb-2 text-center text-sm font-medium tracking-wide text-slate-400"
              >
                周{label}
              </div>
            ))}

            {monthDays.map((day) => {
              const isSelected = day.date === selectedDate;
              const dayMood = day.date
                ? getCalendarDayMood(day.date, day.events.length, expandedScheduleItems)
                : null;

              return (
                <button
                  key={day.key}
                  type="button"
                  disabled={!day.date}
                  onClick={() => day.date && openDayFlow(day.date)}
                  className={`group relative min-h-[4.2rem] overflow-hidden rounded-[1.75rem] border px-2 py-2 text-left transition sm:min-h-[6rem] sm:px-2.5 sm:py-2.5 md:min-h-[8.4rem] ${
                    day.date
                      ? isSelected
                        ? "border-violet-300 bg-[linear-gradient(180deg,#fff7ed_0%,#f5f3ff_42%,#eff6ff_100%)] shadow-[0_14px_32px_rgba(139,92,246,0.14)]"
                        : "border-slate-100 bg-white/95 hover:-translate-y-0.5 hover:border-amber-200 hover:bg-[linear-gradient(180deg,rgba(255,251,235,0.78),rgba(255,255,255,0.92))] hover:shadow-[0_10px_24px_rgba(148,163,184,0.12)]"
                      : "border-transparent bg-transparent"
                  }`}
                >
                  {day.date ? (
                    <div
                      className={`pointer-events-none absolute inset-x-0 top-0 h-10 ${
                        isSelected
                          ? "bg-[linear-gradient(180deg,rgba(251,191,36,0.15),rgba(255,255,255,0))]"
                          : "bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0))]"
                      }`}
                    />
                  ) : null}
                  {day.dayNumber ? (
                    <>
                      <span
                        style={{ fontFamily: "var(--font-calendar-day)" }}
                        className="absolute left-2 top-2 text-lg leading-none font-bold text-slate-800 sm:left-3 sm:top-3 sm:text-2xl md:text-[2rem]"
                      >
                        {day.dayNumber}
                      </span>
                      {dayMood ? (
                        <span
                          title={dayMood.label}
                          aria-label={dayMood.label}
                          className={`absolute right-2 top-2 inline-flex h-3 w-3 rounded-full border shadow-sm sm:right-4 sm:top-4 sm:h-3.5 sm:w-3.5 ${dayMood.className}`}
                        >
                          <span className="sr-only">{dayMood.label}</span>
                        </span>
                      ) : null}

                      <div className="relative mt-11 hidden space-y-1.5 md:block">
                        {day.events.slice(0, 2).map((item) => (
                          <div
                            key={item.id}
                            className={`rounded-2xl border px-2.5 py-2 text-xs font-medium shadow-sm transition group-hover:shadow ${
                              categoryColorMap[item.category]
                            }`}
                          >
                            <div className="truncate leading-5">
                              {getCalendarEventLabel(item.title, item.category)}
                              {item.time ? (
                                <span className="ml-1.5 text-[11px] opacity-75">
                                  {item.time}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                        {day.events.length > 2 ? (
                          <div className="text-xs text-slate-400">
                            另有 {day.events.length - 2} 个重要安排
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
            <p className="text-sm font-medium text-violet-700">{todayFocus.label}</p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {todayFocus.value}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{todayFocus.hint}</p>
          </div>

          <div className="mt-4 rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(135deg,#fff7ed_0%,#f5f3ff_45%,#ecfeff_100%)] p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-sm font-medium text-violet-700">
                  AI 秘书{secretaryInsightMode === "week" ? "本周提示" : "月度提示"}
                </p>
                <h4 className="mt-2 text-xl font-semibold text-slate-900">
                  {secretaryInsight.title}
                </h4>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {secretaryInsight.summary}
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate-600 backdrop-blur">
                <div className="mb-3 inline-flex rounded-full border border-slate-200 bg-white p-1">
                  {(["week", "month"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSecretaryInsightMode(mode)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        secretaryInsightMode === mode
                          ? "bg-slate-900 text-white"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {mode === "week" ? "本周" : "本月"}
                    </button>
                  ))}
                </div>
                <div className="font-medium text-slate-900">
                  {secretaryInsightMode === "week" ? "本周节奏" : "本月节奏"}：
                  {secretaryInsight.paceLabel}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {secretaryInsight.paceHint}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {secretaryInsight.notes.map((note) => (
                <div
                  key={note.label}
                  className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3"
                >
                  <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                    {note.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{note.value}</p>
                </div>
              ))}
            </div>
          </div>
          </SectionCard>
        </div>

        <div
          className={`${topViewMode === "day" ? "block" : "hidden"} transition-all duration-300 ease-out ${
            topViewAnimateIn ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          <SectionCard
            title={`当日流程 · ${selectedDate}`}
            description="这里展示完整的一天，包括日常习惯、自动改期后的安排和 AI 建议时间块。"
            aside={<Badge tone="success">按优先级自动重排</Badge>}
          >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={returnToMonthView}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-violet-200 hover:text-violet-700"
            >
              返回月历
            </button>
            <button
              type="button"
              onClick={() => openQuickAddModal(selectedDate)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-2xl leading-none text-violet-700 transition hover:bg-violet-100"
              aria-label="为这一天快速添加新行程"
            >
              +
            </button>
          </div>

          {selectedDayItems.length > 0 ? (
            <div className="space-y-3">
              {selectedDayItems.map((item) => {
                const isFocused = focusedScheduleItemId === item.id;
                return (
                  <div
                    key={item.id}
                    id={`schedule-${item.id}`}
                    className={`rounded-2xl border p-4 transition-all duration-300 ease-out ${
                      isFocused
                        ? "border-amber-300 bg-amber-50 shadow-[0_0_0_4px_rgba(251,191,36,0.18),0_14px_30px_rgba(148,163,184,0.18)] scale-[1.005]"
                        : "border-slate-100 bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            tone={
                              item.priority === 1
                                ? "danger"
                                : item.priority === 2
                                  ? "medium"
                                  : "low"
                            }
                          >
                            P{item.priority}
                          </Badge>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                              categoryColorMap[item.category]
                            }`}
                          >
                            {item.category}
                          </span>
                          <span className="text-xs text-slate-400">{item.source}</span>
                          {item.status === "rescheduled" ? (
                            <Badge tone="medium">已自动改期</Badge>
                          ) : null}
                          {item.priority === 1 ? (
                            <Badge tone="danger">AI判定高优先</Badge>
                          ) : item.priority === 2 ? (
                            <Badge tone="medium">AI判定中优先</Badge>
                          ) : (
                            <Badge tone="low">AI可后移</Badge>
                          )}
                          {item.recurrence && item.recurrence !== "none" ? (
                            <Badge tone="default">{getRecurrenceLabel(item.recurrence)}</Badge>
                          ) : null}
                          {item.showInMonth ? <Badge tone="default">月历展示</Badge> : null}
                        </div>
                        <h3 className="mt-3 text-base font-semibold text-slate-900">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.note}</p>
                        {item.rescheduledFrom ? (
                          <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                            原计划 {item.rescheduledFrom.start} - {item.rescheduledFrom.end}
                            ，{item.rescheduledFrom.reason}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-700">
                          {item.timeUnknown
                            ? "未注明具体时间"
                            : item.endTimeInferred
                              ? item.start
                              : `${item.start} - ${item.end}`}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          {item.recurrence && item.recurrence !== "none" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditingSingleOccurrence(item)}
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-violet-200 hover:text-violet-700"
                              >
                                只改这次
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditingSeries(item)}
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-violet-200 hover:text-violet-700"
                              >
                                改整个系列
                              </button>
                              <button
                                type="button"
                                onClick={() => skipOccurrence(item)}
                                className="rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm text-amber-700 transition hover:bg-amber-50"
                              >
                                跳过这次
                              </button>
                              <button
                                type="button"
                                onClick={() => pauseRecurringForWeek(item)}
                                className="rounded-2xl border border-sky-200 bg-white px-3 py-2 text-sm text-sky-700 transition hover:bg-sky-50"
                              >
                                本周暂停
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditing(item)}
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-violet-200 hover:text-violet-700"
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item)}
                                className="rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50"
                              >
                                删除
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm leading-6 text-slate-500">
              这一天还没有安排。你可以点上方加号新增日程，或者把 AI 建议加入这一天。
            </div>
          )}

          {selectedDaySummary.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-slate-100 bg-white p-4">
              <p className="text-sm font-medium text-slate-900">这个日期在月历中的重点</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedDaySummary.map((item) => (
                  <span
                    key={item.id}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      categoryColorMap[item.category]
                    }`}
                  >
                    {item.title}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dynamicMetrics.map((item) => (
          <div
            key={item.label}
            className="rounded-[1.8rem] border border-white/70 bg-white/78 p-5 shadow-[0_16px_32px_rgba(148,163,184,0.12)] backdrop-blur-xl"
          >
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{item.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr_1fr]">
        <SectionCard
          id="home-alerts-section"
          title="站内提醒"
          description="第一版先把电脑端提醒做好。现在邮件同步出来的提醒和会议变化也会写回这里。"
        >
          <div className="space-y-3">
            {selectedDayAlerts.map((alert) => {
              const isFocused = focusedAlertId === alert.id;
              return (
                <div
                  key={alert.id}
                  id={`alert-${alert.id}`}
                  className={`rounded-2xl border p-4 transition-all duration-300 ease-out ${
                    isFocused
                      ? "border-amber-300 bg-amber-50 shadow-[0_0_0_4px_rgba(251,191,36,0.18),0_14px_30px_rgba(148,163,184,0.18)] scale-[1.005]"
                      : "border-amber-100 bg-amber-50"
                  }`}
                >
                  <p className="text-sm font-medium text-amber-800">{alert.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{alert.detail}</p>
                  <p className="mt-3 text-sm font-medium text-amber-900">
                    {alert.impact}
                  </p>
                </div>
              );
            })}
            {selectedDayAlerts.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                当前这一天还没有新的改期提醒或邮件同步提醒。
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="AI 秘书建议"
          description="如果你把自己的状态和想法告诉 AI，它可以给你补上成长安排，并推荐值得参加的活动。"
        >
          <div className="space-y-3">
            {suggestions.map((item) => {
              const accepted = acceptedSuggestionIds.includes(item.id);

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone={item.type === "线下活动" ? "medium" : "default"}>
                      {item.type}
                    </Badge>
                    <span className="text-xs text-slate-400">{item.scheduleAt}</span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.summary}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.why}</p>

                  {item.detail ? (
                    <div className="mt-3 rounded-2xl bg-white p-3 text-sm leading-6 text-slate-600">
                      {item.detail}
                    </div>
                  ) : null}

                  {item.checklist?.length ? (
                    <ul className="mt-3 space-y-2">
                      {item.checklist.map((check) => (
                        <li
                          key={check}
                          className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600"
                        >
                          {check}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <button
                    type="button"
                    disabled={accepted}
                    onClick={() => acceptSuggestion(item.id)}
                    className={`mt-4 w-full rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      accepted
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-violet-600 text-white hover:bg-violet-500"
                    }`}
                  >
                    {accepted ? "已加入日程" : "愿意，加入我的日程"}
                  </button>
                </article>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="最近邮件变化"
          description="这里专门告诉你：最近一次邮件同步，究竟给首页和任务中心带来了什么变化。"
          id="home-recent-email-changes-section"
        >
          <div className="space-y-3">
            {recentEmailChanges.length > 0 ? (
              recentEmailChanges.map((change) => {
                const isFocused = focusedRecentChangeId === change.id;
                const isTaskType = change.type === "task";
                const taskFocusId = isTaskType
                  ? createStableId("email-task", change.title)
                  : undefined;
                const homeDeepHref =
                  change.target.kind !== "task-center"
                    ? buildRecentEmailChangeHomeHref(change)
                    : null;
                return (
                  <article
                    key={change.id}
                    id={`change-${change.id}`}
                    className={`rounded-2xl border bg-slate-50 p-4 transition-all duration-300 ease-out ${
                      isFocused
                        ? "border-amber-300 shadow-[0_0_0_4px_rgba(251,191,36,0.18),0_14px_30px_rgba(148,163,184,0.18)] scale-[1.005]"
                        : "border-slate-100"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          change.type === "schedule"
                            ? "danger"
                            : change.type === "task"
                              ? "medium"
                              : "default"
                        }
                      >
                        {change.type === "schedule"
                          ? "写入日程"
                          : change.type === "task"
                            ? "生成任务"
                            : "新增提醒"}
                      </Badge>
                      <span className="text-xs text-slate-400">{change.provider}</span>
                      {isFocused ? <Badge tone="medium">正在定位</Badge> : null}
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-slate-900">{change.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{change.detail}</p>
                    <p className="mt-3 text-xs text-slate-400">
                      最近同步：{change.syncedAt ?? "尚未记录"}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {change.target.kind === "task-center" ? (
                        <Link
                          href={buildTaskCenterHref({
                            mode: "email-generated",
                            focusTaskId: taskFocusId,
                          })}
                          className="inline-flex items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100"
                        >
                          {change.actionLabel}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRecentEmailChangeAction(change)}
                          className="inline-flex items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100"
                        >
                          {change.actionLabel}
                        </button>
                      )}
                      <Link
                        href="/email"
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-violet-200 hover:text-violet-700"
                      >
                        去邮件中心查看来源
                      </Link>
                      {homeDeepHref ? (
                        <button
                          type="button"
                          onClick={() => {
                            const href = `${window.location.origin}${homeDeepHref}`;
                            if (navigator.clipboard) {
                              navigator.clipboard
                                .writeText(href)
                                .then(() => {
                                  setNaturalLanguageFeedback(
                                    `已复制「${change.title}」的定位链接，可以直接粘贴给别人或跨设备打开。`,
                                  );
                                  window.setTimeout(() => {
                                    if (naturalLanguageFeedback.startsWith("已复制")) {
                                      setNaturalLanguageFeedback("");
                                    }
                                  }, 3200);
                                })
                                .catch(() => undefined);
                            }
                          }}
                          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                        >
                          复制定位链接
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                还没有新的邮件变化进入首页。你可以先去
                <Link
                  href="/email"
                  className="mx-1 font-medium text-violet-700 underline-offset-2 hover:underline"
                >
                  邮件页
                </Link>
                连接邮箱并执行同步，首页会在这里告诉你最新写回了什么。
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {isQuickAddOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/70 bg-white/95 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-violet-600">月历快速添加</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                  {editingScope === "single"
                    ? "只修改这一次"
                    : editingItemId
                      ? "编辑当前行程"
                      : "快速加入新行程"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {editingScope === "single"
                    ? "这次修改只会影响当前这一条出现，不会改动整个重复系列。"
                    : "在这里快速新增、编辑行程，也可以直接设置日重复、周重复、月重复、年重复。"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsQuickAddOpen(false);
                  resetForm(selectedDate);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xl text-slate-500 transition hover:border-violet-200 hover:text-violet-700"
                aria-label="关闭弹窗"
              >
                ×
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {quickAddPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, title: preset }))}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition hover:border-violet-200 hover:bg-violet-50"
                >
                  {preset}
                </button>
              ))}
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleQuickAddSubmit}>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="输入新的重要行程"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300"
                />
                <div className="flex min-h-[3.25rem] items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  AI判断优先级：{getPriorityLabel(inferredPriorityPreview)}
                </div>
              </div>

              <textarea
                value={form.note}
                onChange={(event) =>
                  setForm((current) => ({ ...current, note: event.target.value }))
                }
                rows={3}
                placeholder="补充说明，例如活动背景、准备事项或自动改期原因"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300"
              />

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                AI识别类型：{inferredCategory}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm((current) => {
                      const nextDate = event.target.value;
                      const currentWeekday = getWeekdayIndexFromDateString(current.date);
                      const nextWeekday = getWeekdayIndexFromDateString(nextDate);
                      const currentMonthDay = String(getMonthDay(current.date));

                      return {
                        ...current,
                        date: nextDate,
                        recurrenceEndsOn:
                          current.recurrenceEndType === "until" &&
                          (!current.recurrenceEndsOn || current.recurrenceEndsOn < nextDate)
                            ? nextDate
                            : current.recurrenceEndsOn,
                        recurrenceWeekdays:
                          current.recurrence === "weekly" &&
                          current.recurrenceWeekdays.length === 1 &&
                          current.recurrenceWeekdays[0] === currentWeekday
                            ? [nextWeekday]
                            : current.recurrenceWeekdays,
                        recurrenceMonthDay:
                          current.recurrence === "monthly" &&
                          current.recurrenceMonthDay === currentMonthDay
                            ? String(getMonthDay(nextDate))
                            : current.recurrenceMonthDay,
                      };
                    })
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300"
                />
                <input
                  type="time"
                  value={form.start}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, start: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="time"
                  value={form.end}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, end: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300"
                />
                <select
                  value={form.recurrence}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      recurrence: event.target.value as ScheduleRecurrence,
                      recurrenceEndType:
                        event.target.value === "none" ? "never" : current.recurrenceEndType,
                      recurrenceWeekdays:
                        event.target.value === "weekly"
                          ? current.recurrenceWeekdays.length > 0
                            ? current.recurrenceWeekdays
                            : [getWeekdayIndexFromDateString(current.date)]
                          : current.recurrenceWeekdays,
                      recurrenceMonthDay:
                        event.target.value === "monthly"
                          ? current.recurrenceMonthDay || String(getMonthDay(current.date))
                          : current.recurrenceMonthDay,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300"
                >
                  <option value="none">不重复</option>
                  <option value="daily">日重复</option>
                  <option value="weekly">周重复</option>
                  <option value="monthly">月重复</option>
                  <option value="yearly">年重复</option>
                </select>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.showInMonth}
                  disabled={inferredCategory === "学习" || inferredCategory === "健身"}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      showInMonth: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                作为本月重要事项展示在月历中
              </label>

              {inferredCategory === "学习" || inferredCategory === "健身" ? (
                <p className="text-sm leading-6 text-slate-500">
                  学习和健身默认只出现在当日流程里，不会挤占月历。
                </p>
              ) : null}

              {form.recurrence !== "none" ? (
                <div className="space-y-4 rounded-[1.75rem] border border-sky-100 bg-sky-50/80 px-4 py-4">
                  {form.recurrence === "weekly" ? (
                    <div>
                      <p className="text-sm font-medium text-slate-800">每周在这些日期重复</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {weekdayOptions.map((weekday) => {
                          const selected = form.recurrenceWeekdays.includes(weekday.value);
                          return (
                            <button
                              key={weekday.value}
                              type="button"
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  recurrenceWeekdays: selected
                                    ? current.recurrenceWeekdays.filter(
                                        (value) => value !== weekday.value,
                                      )
                                    : uniqueWeekdayIndexes([
                                        ...current.recurrenceWeekdays,
                                        weekday.value,
                                      ]),
                                }))
                              }
                              className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                                selected
                                  ? "border-violet-200 bg-violet-100 text-violet-700"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700"
                              }`}
                            >
                              {weekday.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {form.recurrence === "monthly" ? (
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div>
                        <p className="text-sm font-medium text-slate-800">每月选择第几天重复</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          例如填 15，表示每月 15 号重复一次。
                        </p>
                      </div>
                      <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        每月第
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={form.recurrenceMonthDay}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              recurrenceMonthDay: event.target.value,
                            }))
                          }
                          className="w-16 border-none bg-transparent text-center text-sm text-slate-800 outline-none"
                        />
                        天
                      </label>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      value={form.recurrenceEndType}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          recurrenceEndType: event.target.value as ScheduleRecurrenceEndType,
                          recurrenceEndsOn:
                            event.target.value === "until" && !current.recurrenceEndsOn
                              ? current.date
                              : current.recurrenceEndsOn,
                          recurrenceCount:
                            event.target.value === "count" && !current.recurrenceCount
                              ? "10"
                              : current.recurrenceCount,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300"
                    >
                      <option value="never">永不结束</option>
                      <option value="until">结束于某一天</option>
                      <option value="count">重复 X 次后结束</option>
                    </select>

                    {form.recurrenceEndType === "until" ? (
                      <input
                        type="date"
                        value={form.recurrenceEndsOn}
                        min={form.date}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            recurrenceEndsOn: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300"
                      />
                    ) : null}

                    {form.recurrenceEndType === "count" ? (
                      <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        共
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={form.recurrenceCount}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              recurrenceCount: event.target.value,
                            }))
                          }
                          className="w-20 border-none bg-transparent text-center text-sm text-slate-800 outline-none"
                        />
                        次
                      </label>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm leading-6 text-sky-800">
                    当前规则：{getRecurrenceRuleSummary(form)}
                  </div>
                </div>
              ) : null}

              {formError ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  {editingItemId ? "保存修改" : "加入日程"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickAddOpen(false);
                    resetForm(selectedDate);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-violet-200 hover:text-violet-700"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildInfoAlert(date: string, title: string, detail: string): RescheduleAlert {
  return {
    id: `info-${date}-${Math.random().toString(36).slice(2, 10)}`,
    title,
    detail,
    date,
    impact: "你可以继续编辑、删除，或让后续邮件与建议参与自动重排。",
  };
}

function mergeAlerts(current: RescheduleAlert[], incoming: RescheduleAlert[]) {
  const merged = [...incoming, ...current];
  return merged.slice(0, 12);
}

function getCalendarEventLabel(title: string, category: EventCategory) {
  const compactMap: Record<string, string> = {
    论文初稿截止: "初稿ddl",
    去上海参加面试: "上海面试",
    导师临时组会: "导师组会",
    毕业答辩说明课: "答辩说明",
    课程结课考试: "结课考试",
    电影节展映: "电影",
    城市招聘会: "招聘会",
  };

  if (compactMap[title]) {
    return compactMap[title];
  }

  if (category === "截止日" && title.includes("截止")) {
    return title.replace("论文", "").replace("截止", "ddl");
  }

  if (category === "出行" && title.includes("参加面试")) {
    return title.replace("去", "").replace("参加面试", "面试");
  }

  if (title.length <= 6) {
    return title;
  }

  return `${title.slice(0, 6)}...`;
}

function getRecurrenceLabel(recurrence: ScheduleRecurrence) {
  const labels: Record<ScheduleRecurrence, string> = {
    none: "不重复",
    daily: "日重复",
    weekly: "周重复",
    monthly: "月重复",
    yearly: "年重复",
  };

  return labels[recurrence];
}

function getPriorityLabel(priority: number) {
  if (priority === 1) {
    return "P1 高优先";
  }

  if (priority === 2) {
    return "P2 中优先";
  }

  return "P3 可后移";
}

function inferEventCategoryFromText(
  title: string,
  note: string,
  fallback: EventCategory = "活动",
): EventCategory {
  const combined = `${title} ${note}`.trim();
  if (!combined) {
    return fallback;
  }

  const normalized = combined.toLowerCase();

  if (
    /面试|会议|开会|组会|答辩|汇报|沟通|讨论|面谈|导师/.test(combined) ||
    /meeting|interview|sync/.test(normalized)
  ) {
    return "会议";
  }

  if (
    /截止|ddl|due|提交|交稿|申请截止|报名截止|deadline/.test(normalized)
  ) {
    return "截止日";
  }

  if (
    /机票|航班|火车|高铁|出发|返程|酒店|出行|旅行|机场|车站|flight|train/.test(normalized)
  ) {
    return "出行";
  }

  if (
    /考试|测验|笔试|机考|考核|exam|quiz|test/.test(normalized)
  ) {
    return "考试";
  }

  if (
    /上课|课程|讲座|听课|课程说明|class|course|lecture/.test(normalized)
  ) {
    return "上课";
  }

  if (
    /学习|复习|刷题|读书|论文|简历|求职|练习|作品集|study|learn|resume/.test(normalized)
  ) {
    return "学习";
  }

  if (
    /健身|跑步|力量|瑜伽|游泳|羽毛球|锻炼|gym|workout|run/.test(normalized)
  ) {
    return "健身";
  }

  return "活动";
}

function parseNaturalLanguageInput(
  text: string,
  todayDate: string,
  fallbackDate: string,
): NaturalLanguageParseResult | null {
  const clauses = splitNaturalLanguageClauses(text);
  const items: NaturalLanguageDraft[] = [];
  let currentContextDate: string | null = null;
  let hasSchedule = false;
  let hasRecord = false;

  clauses.forEach((clause) => {
    const resolvedDate =
      extractDateFromText(clause, todayDate, currentContextDate) ?? currentContextDate ?? fallbackDate;
    const mode = detectClauseMode(clause, resolvedDate, todayDate);
    currentContextDate = resolvedDate;

    if (mode === "record") {
      const recordItems = buildDailyRecordDrafts(clause, resolvedDate);
      if (recordItems.length > 0) {
        hasRecord = true;
        items.push(...recordItems);
      }
      return;
    }

    const title = extractPrimaryActivityTitle(clause);
    if (!title) {
      return;
    }

    const explicitStartTime = extractStartTimeFromText(clause);
    const hasTimeContext = hasScheduleTimeContext(clause);
    const start = explicitStartTime ?? (hasTimeContext ? getDefaultScheduleTime(clause) : "09:00");
    const explicitDurationMinutes = extractDurationMinutesFromText(clause);
    const durationMinutes = explicitDurationMinutes ?? 60;
    const end = addMinutesToTime(start, durationMinutes);
    const category = inferEventCategoryFromText(title, clause);

    items.push({
      mode: "schedule",
      title,
      note: `由自然语言识别加入：${clause}`,
      date: resolvedDate,
      start,
      end,
      timeUnknown: !explicitStartTime && !hasTimeContext,
      endTimeInferred: explicitDurationMinutes === null,
      showInMonth: category === "学习" || category === "健身" ? false : true,
    });
    hasSchedule = true;
  });

  if (items.length === 0) {
    return null;
  }

  const firstSchedule = items.find((item) => item.mode === "schedule");
  const firstRecord = items.find((item) => item.mode === "record");
  const focusDate = firstSchedule?.date ?? firstRecord?.date ?? fallbackDate;
  const preferredView = hasSchedule ? "month" : "day";
  const summaryParts: string[] = [];

  if (hasSchedule) {
    const scheduleTitles = items
      .filter((item) => item.mode === "schedule")
      .map((item) => `${formatDisplayDate(item.date)} ${item.title}`);
    summaryParts.push(`准备加入 ${scheduleTitles.join("、")}`);
  }

  if (hasRecord) {
    const recordTitles = items
      .filter((item) => item.mode === "record")
      .map((item) => `${formatDisplayDate(item.date)} ${item.title}`);
    summaryParts.push(`准备记录 ${recordTitles.join("、")}`);
  }

  return {
    items,
    message: summaryParts.join("；"),
    focusDate,
    preferredView,
    hasSchedule,
    hasRecord,
  };
}

function isPastRecordText(text: string) {
  return /昨天|前天|昨晚|上周|刚刚|已经|打了|做了|去了|看了|参加了|玩了|聚了|开party了|开派对了|聊了|吃了/.test(
    text,
  );
}

function buildDailyRecordDrafts(text: string, date: string): NaturalLanguageDraft[] {
  const clauses = splitRecordClauses(text);

  const items: NaturalLanguageDraft[] = [];

  clauses.forEach((clause, clauseIndex) => {
    const baseMinutes = getApproximateMinutesForClause(clause, clauseIndex);
    const titles = extractActivityTitlesFromClause(clause);

    titles.forEach((title, titleIndex) => {
      const startMinutes = baseMinutes + titleIndex * 120;
      const start = toTime(startMinutes);
      const end = toTime(startMinutes + 90);
      items.push({
        mode: "record",
        title,
        note: `由自然语言记录：${text}`,
        date,
        start,
        end,
        timeUnknown: true,
        showInMonth: false,
      });
    });
  });

  return items;
}

function extractActivityTitlesFromClause(clause: string) {
  const normalized = clause.toLowerCase();
  const matches: Array<{ index: number; title: string }> = [];

  const patterns = [
    {
      regex: /麻将/,
      title: "打麻将",
    },
    {
      regex: /篮球/,
      title: "打篮球",
    },
    {
      regex: /羽毛球/,
      title: "打羽毛球",
    },
    {
      regex: /跑步/,
      title: "跑步",
    },
    {
      regex: /做饭|做菜/,
      title: clause.includes("和朋友") ? "和朋友做饭" : "做饭",
    },
    {
      regex: /汉堡|burger/,
      title: "吃汉堡",
    },
    {
      regex: /炸鸡/,
      title: "吃炸鸡",
    },
    {
      regex: /奶茶/,
      title: "喝奶茶",
    },
    {
      regex: /party|派对/,
      title: "PARTY",
    },
    {
      regex: /电影|展映/,
      title: "看电影",
    },
    {
      regex: /会议|开会|组会/,
      title: "开会",
    },
    {
      regex: /吃饭|聚餐|聚会/,
      title: clause.includes("朋友") ? "和朋友聚餐" : "聚餐",
    },
  ] as const;

  patterns.forEach((pattern) => {
    const match = normalized.match(pattern.regex);
    if (match?.index !== undefined) {
      matches.push({
        index: match.index,
        title: pattern.title,
      });
    }
  });

  const ordered = matches.sort((left, right) => left.index - right.index);
  if (ordered.length > 0) {
    return uniqueTitles(ordered.map((item) => item.title)).filter(isMeaningfulActivityTitle);
  }

  const eatSpecificMatch = clause.match(
    /吃(?:了)?(?:个|份|顿|些|点)?([^\s，,。；;]{1,6})/,
  );
  if (eatSpecificMatch?.[1]) {
    const title = `吃${sanitizeFoodTitle(eatSpecificMatch[1])}`;
    return isMeaningfulActivityTitle(title) ? [title] : [];
  }

  const fallback = extractPrimaryActivityTitle(clause);
  return fallback && isMeaningfulActivityTitle(fallback) ? [fallback] : [];
}

function extractPrimaryActivityTitle(text: string) {
  const normalized = text.toLowerCase();

  if (/麻将/.test(text)) {
    return "打麻将";
  }
  if (/篮球/.test(text)) {
    return "打篮球";
  }
  if (/羽毛球/.test(text)) {
    return "打羽毛球";
  }
  if (/跑步/.test(text)) {
    return "跑步";
  }
  if (/做饭|做菜/.test(text)) {
    return text.includes("和朋友") ? "和朋友做饭" : "做饭";
  }
  if (/party|派对/.test(normalized)) {
    return "PARTY";
  }
  if (/电影|展映/.test(text)) {
    return "看电影";
  }
  if (/考试|笔试|机考/.test(text)) {
    return "考试";
  }
  if (/面试/.test(text)) {
    return "面试";
  }
  if (/会议|开会|组会/.test(text)) {
    return "开会";
  }
  if (/上课|课程|讲座/.test(text)) {
    return "上课";
  }

  const englishTitle = text
    .replace(
      /(今天|明天|后天|昨天|前天|今晚|上午|中午|下午|晚上|凌晨|傍晚|早上|今早|今晨|这周末|本周末|这个周末|下周[一二三四五六日天]|(?:这周|本周)?周[一二三四五六日天])/g,
      " ",
    )
    .replace(/(\d{1,2})月(\d{1,2})[日号]?/g, " ")
    .replace(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/g, " ")
    .replace(/(\d{1,2})[:：](\d{2})/g, " ")
    .replace(/([零一二两三四五六七八九十百\d]{1,3})点(半)?/g, " ")
    .replace(/([零一二两三四五六七八九十百\d]+)(?:个)?(?:小时|钟头|分钟|分)/g, " ")
    .replace(/\b(arrange|schedule)\b/gi, " ")
    .replace(/[()（）]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/[A-Za-z]/.test(englishTitle)) {
    return englishTitle;
  }

  const cleaned = text
    .replace(/今天|明天|后天|昨天|前天|上午|中午|下午|晚上|凌晨|傍晚/g, "")
    .replace(/(\d{1,2})月(\d{1,2})[日号]?/g, "")
    .replace(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/g, "")
    .replace(/[零一二两三四五六七八九十百\d]+点半?/g, "")
    .replace(/[零一二两三四五六七八九十百\d]+小时/g, "")
    .replace(/去|要|安排|一下|一个|两个|了|呢/g, "")
    .replace(/\s+/g, "")
    .trim();

  return cleaned ? cleaned.slice(0, 10) : "";
}

function extractDateFromText(text: string, todayDate: string, contextDate?: string | null) {
  if (text.includes("今晚")) {
    return todayDate;
  }
  if (text.includes("今天")) {
    return todayDate;
  }
  if (text.includes("明天")) {
    return shiftDate(todayDate, 1);
  }
  if (text.includes("后天")) {
    return shiftDate(todayDate, 2);
  }
  if (text.includes("昨天")) {
    return shiftDate(todayDate, -1);
  }
  if (text.includes("前天")) {
    return shiftDate(todayDate, -2);
  }

  if (/这个周末|这周末|本周末/.test(text)) {
    return getWeekendDate(todayDate, 0);
  }

  const nextWeekdayMatch = text.match(/下周([一二三四五六日天])/);
  if (nextWeekdayMatch) {
    return getRelativeWeekdayDate(todayDate, nextWeekdayMatch[1], 1);
  }

  const weekdayMatch = text.match(/(?:这周|本周)?周([一二三四五六日天])/);
  if (weekdayMatch) {
    return getRelativeWeekdayDate(todayDate, weekdayMatch[1], 0);
  }

  const slashMatch = text.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[3].padStart(2, "0")}`;
  }

  const monthDayMatch = text.match(/(\d{1,2})月(\d{1,2})[日号]?/);
  if (monthDayMatch) {
    const year = todayDate.slice(0, 4);
    return `${year}-${monthDayMatch[1].padStart(2, "0")}-${monthDayMatch[2].padStart(2, "0")}`;
  }

  return contextDate ?? null;
}

function extractStartTimeFromText(text: string) {
  const directMatch = text.match(/(\d{1,2})[:：](\d{2})/);
  if (directMatch) {
    return `${directMatch[1].padStart(2, "0")}:${directMatch[2]}`;
  }

  const hourMatch = text.match(/(上午|中午|下午|晚上|凌晨)?([零一二两三四五六七八九十\d]{1,3})点(半)?/);
  if (!hourMatch) {
    return null;
  }

  let hour = parseChineseNumber(hourMatch[2]);
  const period = hourMatch[1] ?? "";
  const hasHalf = Boolean(hourMatch[3]);

  if ((period === "下午" || period === "晚上") && hour < 12) {
    hour += 12;
  }
  if (period === "中午" && hour < 11) {
    hour += 12;
  }
  if (period === "凌晨" && hour === 12) {
    hour = 0;
  }

  return `${String(hour).padStart(2, "0")}:${hasHalf ? "30" : "00"}`;
}

function extractDurationMinutesFromText(text: string) {
  const halfCompositeMatch = text.match(/([零一二两三四五六七八九十\d]+)(?:个)?半小时/);
  if (halfCompositeMatch) {
    return parseChineseNumber(halfCompositeMatch[1]) * 60 + 30;
  }

  const durationMatch = text.match(/([零一二两三四五六七八九十\d]+)(?:个)?(?:小时|钟头)/);
  if (durationMatch) {
    return parseChineseNumber(durationMatch[1]) * 60;
  }

  const halfHourMatch = text.match(/半小时/);
  if (halfHourMatch) {
    return 30;
  }

  const minuteMatch = text.match(/([零一二两三四五六七八九十\d]+)分钟/);
  if (minuteMatch) {
    return parseChineseNumber(minuteMatch[1]);
  }

  return null;
}

function getApproximateMinutesForClause(clause: string, clauseIndex: number) {
  if (clause.includes("凌晨")) {
    return 1 * 60;
  }
  if (clause.includes("早上") || clause.includes("上午")) {
    return 9 * 60;
  }
  if (clause.includes("中午")) {
    return 12 * 60 + 30;
  }
  if (clause.includes("下午")) {
    return 15 * 60;
  }
  if (clause.includes("傍晚")) {
    return 18 * 60;
  }
  if (clause.includes("晚上") || clause.includes("今晚")) {
    return 19 * 60;
  }

  return 9 * 60 + clauseIndex * 180;
}

function getDefaultScheduleTime(text: string) {
  if (text.includes("今晚") || text.includes("晚上")) {
    return "19:00";
  }
  if (text.includes("下午")) {
    return "15:00";
  }
  if (text.includes("中午")) {
    return "12:30";
  }
  if (text.includes("上午") || text.includes("早上")) {
    return "09:00";
  }
  if (text.includes("周末")) {
    return "14:00";
  }

  return "19:00";
}

function hasScheduleTimeContext(text: string) {
  return /(今晚|晚上|下午|上午|中午|凌晨|傍晚|早上|今早|今晨)/.test(text);
}

function addMinutesToTime(time: string, minutes: number) {
  return toTime(toMinutes(time) + minutes);
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

function shiftDate(date: string, days: number) {
  const target = new Date(`${date}T00:00:00`);
  target.setDate(target.getDate() + days);
  return formatDate(target.getFullYear(), target.getMonth(), target.getDate());
}

function splitNaturalLanguageClauses(text: string) {
  return text
    .split(/[，,。；;]/)
    .flatMap((item) => item.split(/(?=然后|再|并且|而且)/))
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitRecordClauses(text: string) {
  const segments = text
    .split(/[，,。；;]/)
    .flatMap((item) =>
      item
        .split(/(?=(?:凌晨|早上|上午|中午|下午|傍晚|晚上|今晚))/)
        .flatMap((segment) => segment.split(/(?=然后|再|并且|而且)/)),
    )
    .map((item) => item.trim())
    .filter(Boolean);

  return mergeContextOnlySegments(segments);
}

function detectClauseMode(clause: string, resolvedDate: string, todayDate: string) {
  if (isPastRecordText(clause)) {
    return "record" as const;
  }

  if (resolvedDate < todayDate) {
    return "record" as const;
  }

  return "schedule" as const;
}

function getRelativeWeekdayDate(todayDate: string, weekdayText: string, extraWeeks: number) {
  const targetWeekday = mapWeekdayTextToIndex(weekdayText);
  if (!targetWeekday) {
    return todayDate;
  }

  const today = new Date(`${todayDate}T00:00:00`);
  const currentWeekday = getIsoWeekday(today);
  let diff = targetWeekday - currentWeekday + extraWeeks * 7;

  if (extraWeeks === 0 && diff < 0) {
    diff += 7;
  }

  if (extraWeeks > 0 && diff <= 0) {
    diff += 7;
  }

  return shiftDate(todayDate, diff);
}

function getWeekendDate(todayDate: string, extraWeeks: number) {
  const today = new Date(`${todayDate}T00:00:00`);
  const currentWeekday = getIsoWeekday(today);
  let diff = 6 - currentWeekday + extraWeeks * 7;
  if (extraWeeks === 0 && diff < 0) {
    diff += 7;
  }
  return shiftDate(todayDate, diff);
}

function mapWeekdayTextToIndex(weekdayText: string) {
  const map: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    日: 7,
    天: 7,
  };

  return map[weekdayText];
}

function getIsoWeekday(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function parseChineseNumber(input: string) {
  if (/^\d+$/.test(input)) {
    return Number(input);
  }

  const digitMap: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  if (input === "十") {
    return 10;
  }

  if (input.includes("十")) {
    const [left, right] = input.split("十");
    const tens = left ? digitMap[left] ?? 0 : 1;
    const ones = right ? digitMap[right] ?? 0 : 0;
    return tens * 10 + ones;
  }

  return digitMap[input] ?? 0;
}

function uniqueTitles(titles: string[]) {
  return [...new Set(titles)];
}

function releaseActiveElementFocus() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function sanitizeFoodTitle(value: string) {
  return value
    .replace(/(凌晨|早上|上午|中午|下午|傍晚|晚上|今晚|昨天|前天|今天|明天|后天)/g, "")
    .replace(/去|了|的/g, "")
    .trim()
    .slice(0, 6);
}

function isMeaningfulActivityTitle(title: string) {
  const normalized = title.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const invalidTitles = new Set([
    "我",
    "我们",
    "昨天",
    "前天",
    "今天",
    "明天",
    "后天",
    "下午",
    "上午",
    "中午",
    "晚上",
    "今晚",
    "早上",
    "傍晚",
    "去了",
    "安排",
  ]);

  if (invalidTitles.has(normalized)) {
    return false;
  }

  return normalized.length >= 2;
}

function mergeContextOnlySegments(segments: string[]) {
  const merged: string[] = [];

  segments.forEach((segment) => {
    if (
      merged.length > 0 &&
      isContextOnlySegment(merged[merged.length - 1]) &&
      /^(凌晨|早上|上午|中午|下午|傍晚|晚上|今晚)/.test(segment)
    ) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}${segment}`;
      return;
    }

    merged.push(segment);
  });

  return merged;
}

function isContextOnlySegment(segment: string) {
  const cleaned = segment.replace(/\s+/g, "");
  return /^(我|我们)?(昨天|前天|今天|明天|后天|昨晚)?$/.test(cleaned);
}

function getRecurrenceNotice(form: QuickAddForm) {
  if (form.recurrence === "none") {
    return "";
  }

  return ` 当前已设为${getRecurrenceRuleSummary(form)}。`;
}

function getMonthSecretaryInsight(
  viewedMonth: string,
  scheduleItems: DailyScheduleItem[],
  suggestionItems: typeof suggestions,
) {
  const monthPrefix = viewedMonth.slice(0, 7);
  const monthItems = scheduleItems.filter(
    (item) => item.date.startsWith(monthPrefix) && item.showInMonth,
  );
  const criticalItems = monthItems.filter((item) => item.priority === 1);
  const rescheduledCount = scheduleItems.filter(
    (item) => item.date.startsWith(monthPrefix) && item.status === "rescheduled",
  ).length;
  const growthSuggestions = suggestionItems.filter(
    (item) =>
      item.type === "成长建议" && item.scheduleAt.startsWith(monthPrefix),
  ).length;
  const nextCritical = criticalItems
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date))[0];

  const paceLabel =
    criticalItems.length >= 3 ? "关键节点较密" : criticalItems.length >= 1 ? "稳中有压" : "相对舒展";
  const paceHint =
    criticalItems.length >= 3
      ? "建议提前处理高优先级事项，避免后半月堆积。"
      : criticalItems.length >= 1
        ? "重要事项不算多，但值得提前留出缓冲。"
        : "这个月可以多放一些成长探索和恢复时间。";

  return {
    title:
      criticalItems.length >= 3
        ? "这个月有几件关键节点，我会帮你盯住节奏。"
        : criticalItems.length >= 1
          ? "这个月重点不算多，适合把关键事做稳。"
          : "这个月节奏比较松，适合主动安排成长事项。",
    summary:
      nextCritical
        ? `离你最近的重要节点是 ${nextCritical.title}（${formatDisplayDate(nextCritical.date)} ${nextCritical.start}）。我建议把准备动作尽量前置，不要压到最后一天。`
        : "本月暂时没有特别密集的关键节点，可以把一些求职探索、学习和线下活动安排进来。",
    paceLabel,
    paceHint,
    notes: [
      {
        label: "重点节点",
        value:
          criticalItems.length > 0
            ? `本月有 ${criticalItems.length} 个高优先级事项，最值得提前准备的是 ${getCalendarEventLabel(
                criticalItems[0].title,
                criticalItems[0].category,
              )}。`
            : "还没有特别硬的截止或出行节点，可以更主动地安排成长与探索。",
      },
      {
        label: "变化提醒",
        value:
          rescheduledCount > 0
            ? `这个月已经发生 ${rescheduledCount} 次自动改期，说明你的日程有动态变化，我会继续优先保住关键事项。`
            : "这个月目前没有明显冲突，整体安排还算平稳。",
      },
      {
        label: "秘书建议",
        value:
          growthSuggestions > 0
            ? `我还为你留了 ${growthSuggestions} 条成长建议，适合放在相对空一点的日期里。`
            : "如果你愿意，我建议补一些学习块或求职探索任务，让空白日更有价值。",
      },
    ],
  };
}

function getWeekSecretaryInsight(
  selectedDate: string,
  scheduleItems: DailyScheduleItem[],
  suggestionItems: typeof suggestions,
) {
  const weekDates = getWeekDates(selectedDate);
  const weekItems = scheduleItems.filter((item) => weekDates.includes(item.date));
  const importantWeekItems = weekItems.filter((item) => item.showInMonth);
  const criticalItems = weekItems.filter((item) => item.priority === 1);
  const rescheduledCount = weekItems.filter((item) => item.status === "rescheduled").length;
  const growthItems = weekItems.filter((item) => item.category === "学习").length;
  const pendingSuggestionCount = suggestionItems.filter((item) => {
    const [date] = item.scheduleAt.split(" ");
    return weekDates.includes(date);
  }).length;
  const nextImportant = weekItems
    .slice()
    .sort((left, right) =>
      `${left.date}-${left.start}`.localeCompare(`${right.date}-${right.start}`),
    )[0];

  const paceLabel =
    criticalItems.length >= 2
      ? "关键周"
      : importantWeekItems.length >= 2
        ? "有安排但可控"
        : "节奏较松";
  const paceHint =
    criticalItems.length >= 2
      ? "这周需要更主动地留缓冲，避免临时变化把节奏打乱。"
      : importantWeekItems.length >= 2
        ? "这周有几件重点，但整体仍有可调整空间。"
        : "这周可利用的空档较多，适合补成长任务和恢复时间。";

  return {
    title:
      criticalItems.length >= 2
        ? "这周有关键节点，我建议你把注意力收拢一点。"
        : importantWeekItems.length >= 2
          ? "这周重点不多不少，适合稳稳推进。"
          : "这周相对轻一点，可以主动为成长留位置。",
    summary:
      nextImportant
        ? `离你最近的安排是 ${nextImportant.title}（${formatDisplayDate(nextImportant.date)} ${nextImportant.start}）。如果你这周状态一般，我建议优先保住关键节点，其它事项可以后移。`
        : "这周目前没有明显的关键安排，我建议你主动放一段学习或求职探索时间进去。",
    paceLabel,
    paceHint,
    notes: [
      {
        label: "这周重点",
        value:
          criticalItems.length > 0
            ? `这周有 ${criticalItems.length} 个高优先级事项，最值得先准备的是 ${getCalendarEventLabel(
                criticalItems[0].title,
                criticalItems[0].category,
              )}。`
            : "这周没有特别硬的节点，适合把重要但不紧急的事慢慢推进。",
      },
      {
        label: "节奏变化",
        value:
          rescheduledCount > 0
            ? `这周已有 ${rescheduledCount} 次改期，我会继续优先替你保住关键安排。`
            : "这周目前没有明显冲突，节奏还算平稳。",
      },
      {
        label: "秘书建议",
        value:
          growthItems > 0
            ? `这周已经安排了 ${growthItems} 段成长时间。${
                pendingSuggestionCount > 0 ? `另外还有 ${pendingSuggestionCount} 条建议可确认。` : "如果状态允许，可以再补一点求职探索。"
              }`
            : pendingSuggestionCount > 0
              ? `我还留了 ${pendingSuggestionCount} 条建议等你确认，适合塞进相对轻的那几天。`
              : "如果你愿意，我建议给这周补一段学习块或线下活动探索。",
      },
    ],
  };
}

function getCalendarDayMood(
  date: string,
  importantEventCount: number,
  scheduleItems: DailyScheduleItem[],
) {
  const dayItems = scheduleItems.filter((item) => item.date === date);
  const hasCritical = dayItems.some((item) => item.priority === 1);
  const hasRescheduled = dayItems.some((item) => item.status === "rescheduled");
  const hasClass = dayItems.some((item) => item.category === "上课");
  const hasMailTask = dayItems.some((item) => item.source === "邮件同步");
  const hasInterestingPlan = dayItems.some(
    (item) =>
      item.category === "活动" ||
      /电影|演唱会|展映|招聘会|线下活动|见面|约会|聚会/.test(item.title),
  );
  const totalCount = dayItems.length;

  if (hasCritical) {
    return {
      label: "特别重要",
      className: "border-rose-300 bg-rose-500",
    };
  }

  if (totalCount >= 3 || hasClass || hasMailTask || hasRescheduled) {
    return {
      label: "今天较忙",
      className: "border-amber-300 bg-amber-400",
    };
  }

  if (hasInterestingPlan || (importantEventCount > 0 && totalCount <= 2)) {
    return {
      label: "有点期待",
      className: "border-emerald-300 bg-emerald-400",
    };
  }

  return {
    label: "空闲",
    className: "border-slate-300 bg-white",
  };
}

function createDefaultForm(date: string): QuickAddForm {
  return {
    title: "",
    note: "",
    date,
    start: "19:00",
    end: "20:00",
    category: "活动",
    showInMonth: true,
    recurrence: "none",
    recurrenceEndType: "never",
    recurrenceEndsOn: date,
    recurrenceCount: "10",
    recurrenceWeekdays: [getWeekdayIndexFromDateString(date)],
    recurrenceMonthDay: String(getMonthDay(date)),
  };
}

function buildFormFromItem(item: DailyScheduleItem, forceSingleOccurrence = false): QuickAddForm {
  return {
    title: item.title,
    note: item.note,
    date: item.date,
    start: item.start,
    end: item.end,
    category: item.category,
    showInMonth: item.showInMonth,
    recurrence: forceSingleOccurrence ? "none" : item.recurrence ?? "none",
    recurrenceEndType: forceSingleOccurrence ? "never" : item.recurrenceEndType ?? "never",
    recurrenceEndsOn: forceSingleOccurrence ? item.date : item.recurrenceEndsOn ?? item.date,
    recurrenceCount: String(item.recurrenceCount ?? 10),
    recurrenceWeekdays:
      item.recurrenceWeekdays?.length
        ? uniqueWeekdayIndexes(item.recurrenceWeekdays)
        : [getWeekdayIndexFromDateString(item.date)],
    recurrenceMonthDay: String(item.recurrenceMonthDay ?? getMonthDay(item.date)),
  };
}

function getMonthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function shiftMonth(monthStart: string, direction: -1 | 1) {
  const date = new Date(`${monthStart}T00:00:00`);
  date.setMonth(date.getMonth() + direction);
  return formatDate(date.getFullYear(), date.getMonth(), 1);
}

function getDefaultDateForMonth(monthStart: string) {
  return monthStart;
}

function formatMonthLabel(monthStart: string) {
  const date = new Date(`${monthStart}T00:00:00`);
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

function formatDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getTodayDate() {
  const today = new Date();
  return formatDate(today.getFullYear(), today.getMonth(), today.getDate());
}

function formatDisplayDate(date: string) {
  return `${date.slice(5, 7)} 月 ${date.slice(8, 10)} 日`;
}

function getWeekDates(date: string) {
  const target = new Date(`${date}T00:00:00`);
  const jsDay = target.getDay();
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(target);
  monday.setDate(target.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + index);
    return formatDate(current.getFullYear(), current.getMonth(), current.getDate());
  });
}

function uniqueDates(dates: string[]) {
  return [...new Set(dates)].sort((left, right) => left.localeCompare(right));
}

function shouldSkipDateForSeries(item: DailyScheduleItem, date: string) {
  const recurrence = item.recurrence ?? "none";
  if (recurrence === "none" || date < item.date) {
    return false;
  }

  if (
    item.recurrenceEndType === "until" &&
    item.recurrenceEndsOn &&
    date > item.recurrenceEndsOn
  ) {
    return false;
  }

  if (!matchesRecurringDate(item, date)) {
    return false;
  }

  if (
    item.recurrenceEndType === "count" &&
    item.recurrenceCount &&
    getOccurrenceIndex(item, date) > item.recurrenceCount
  ) {
    return false;
  }

  return true;
}

function matchesRecurringDate(item: DailyScheduleItem, date: string) {
  const recurrence = item.recurrence ?? "none";
  if (recurrence === "none" || date < item.date) {
    return false;
  }

  if (recurrence === "daily") {
    return true;
  }

  const base = new Date(`${item.date}T00:00:00`);
  const current = new Date(`${date}T00:00:00`);

  if (recurrence === "weekly") {
    const weekdays = item.recurrenceWeekdays?.length
      ? uniqueWeekdayIndexes(item.recurrenceWeekdays)
      : [getWeekdayIndexFromDateString(item.date)];
    return weekdays.includes(toWeekdayIndex(current));
  }

  if (recurrence === "monthly") {
    return current.getDate() === (item.recurrenceMonthDay ?? base.getDate());
  }

  if (recurrence === "yearly") {
    return base.getMonth() === current.getMonth() && base.getDate() === current.getDate();
  }

  return false;
}

function getOccurrenceIndex(item: DailyScheduleItem, date: string) {
  if (!matchesRecurringDate(item, date)) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(`${item.date}T00:00:00`);
  const target = new Date(`${date}T00:00:00`);

  while (cursor <= target) {
    const current = formatDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    if (matchesRecurringDate(item, current)) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function uniqueWeekdayIndexes(values: number[]) {
  return [...new Set(values.filter((value) => value >= 1 && value <= 7))].sort(
    (left, right) => left - right,
  );
}

function getWeekdayIndexFromDateString(date: string) {
  return toWeekdayIndex(new Date(`${date}T00:00:00`));
}

function getMonthDay(date: string) {
  return Number(date.slice(8, 10));
}

function toWeekdayIndex(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function getRecurrenceRuleSummary(form: QuickAddForm) {
  if (form.recurrence === "none") {
    return "不重复";
  }

  let summary = "";

  if (form.recurrence === "daily") {
    summary = "每天重复";
  }

  if (form.recurrence === "weekly") {
    const labels = uniqueWeekdayIndexes(form.recurrenceWeekdays)
      .map((value) => weekdayOptions.find((weekday) => weekday.value === value)?.label)
      .filter(Boolean)
      .join("、");
    summary = labels ? `每周 ${labels} 重复` : "每周重复";
  }

  if (form.recurrence === "monthly") {
    summary = `每月 ${form.recurrenceMonthDay || getMonthDay(form.date)} 号重复`;
  }

  if (form.recurrence === "yearly") {
    summary = `每年 ${formatDisplayDate(form.date)} 重复`;
  }

  if (form.recurrenceEndType === "until" && form.recurrenceEndsOn) {
    return `${summary}，到 ${formatDisplayDate(form.recurrenceEndsOn)} 结束`;
  }

  if (form.recurrenceEndType === "count" && form.recurrenceCount) {
    return `${summary}，共 ${form.recurrenceCount} 次`;
  }

  return `${summary}，永不结束`;
}
