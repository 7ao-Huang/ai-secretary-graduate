"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { navItems } from "@/lib/mock-data";

type AppShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  showPageIntro?: boolean;
  highlight?: {
    label: string;
    value: string;
    hint: string;
  };
};

export function AppShell({
  title,
  description,
  children,
  showPageIntro = true,
  highlight,
}: AppShellProps) {
  const roundedSidebarFont =
    'ui-rounded, "SF Pro Rounded", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("myflow-shell-sidebar-open");
      if (stored !== null) {
        setSidebarOpen(stored === "true");
      }
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem("myflow-shell-sidebar-open", String(sidebarOpen));
  }, [isHydrated, sidebarOpen]);

  // 深色模式：从 localStorage 恢复
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("myflow-theme-dark");
      if (stored !== null) {
        setDark(stored === "true");
      }
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // 深色模式：同步到 <html> class 与 localStorage
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      window.localStorage.setItem("myflow-theme-dark", String(dark));
    } catch {
      /* ignore */
    }
  }, [dark]);

  // 路由变化时自动关闭移动端抽屉
  useEffect(() => {
    queueMicrotask(() => setMobileNavOpen(false));
  }, [pathname]);

  // 移动端抽屉打开时锁定背景滚动
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] gap-4 px-3 py-3 md:gap-6 md:px-6 lg:px-8">
        {/* 移动端汉堡按钮（固定在左上角） */}
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="fixed left-3 top-3 z-40 flex h-11 w-11 items-center justify-center rounded-xl border border-white/70 bg-white/88 text-slate-600 shadow-sm backdrop-blur transition hover:border-violet-200 hover:text-violet-700 lg:hidden"
          aria-label="打开导航栏"
        >
          <span className="text-xl leading-none">≡</span>
        </button>

        {/* 移动端遮罩层 */}
        {mobileNavOpen ? (
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}

        <div className="relative shrink-0">
          {!sidebarOpen ? (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="sticky top-4 hidden h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white/88 text-slate-600 shadow-sm backdrop-blur transition hover:border-violet-200 hover:text-violet-700 lg:flex"
              aria-label="展开导航栏"
            >
              <span className="text-xl leading-none">≡</span>
            </button>
          ) : (
            <aside
              className={`fixed inset-y-0 left-0 z-50 flex w-[13.5rem] flex-col rounded-r-[2rem] border border-r border-white/70 bg-white/90 p-4 shadow-[0_16px_40px_rgba(148,163,184,0.14)] backdrop-blur-xl transition-transform duration-300 lg:static lg:top-3 lg:h-[calc(100vh-1.5rem)] lg:translate-x-0 lg:rounded-[2rem] lg:border ${
                mobileNavOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                {/* 移动端关闭按钮 */}
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg text-slate-500 transition hover:border-violet-200 hover:text-violet-700 lg:hidden"
                  aria-label="关闭导航栏"
                >
                  ✕
                </button>
                {/* 桌面端收起按钮 */}
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="ml-auto hidden h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg text-slate-500 transition hover:border-violet-200 hover:text-violet-700 lg:flex"
                  aria-label="收起导航栏"
                >
                  ‹
                </button>
              </div>

              {/* 深色模式切换 */}
              <button
                type="button"
                onClick={() => setDark((d) => !d)}
                className="mb-3 flex w-full items-center justify-between rounded-[1.3rem] border border-slate-100 bg-white/50 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-violet-200 hover:bg-violet-50/70 hover:text-violet-700"
                aria-label={dark ? "切换到浅色模式" : "切换到深色模式"}
              >
                <span>{dark ? "深色模式" : "浅色模式"}</span>
                <span className="text-base leading-none">{dark ? "🌙" : "☀️"}</span>
              </button>

              <nav className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                {navItems.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname?.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{ fontFamily: roundedSidebarFont }}
                      className={`block rounded-[1.3rem] border px-3 py-3 text-left transition ${
                        active
                          ? "border-violet-200 bg-violet-50/90 shadow-sm"
                          : "border-transparent bg-white/35 hover:border-violet-100 hover:bg-white/70"
                      }`}
                    >
                      <div className="text-sm font-semibold tracking-[0.01em] text-slate-900 md:text-[15px]">
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>

              {/* 关于这个作品入口 */}
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                className="mt-3 w-full rounded-[1.3rem] border border-slate-100 bg-white/50 px-3 py-3 text-left text-sm font-medium text-slate-500 transition hover:border-violet-200 hover:bg-violet-50/70 hover:text-violet-700"
              >
                <span className="mr-1.5">ⓘ</span>
                关于这个作品
              </button>
            </aside>
          )}
        </div>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col pt-14 lg:pt-0">
          <main className="flex-1">
            {showPageIntro ? (
              <section className="mb-6 rounded-[2rem] border border-white/75 bg-white/78 p-6 shadow-[0_16px_38px_rgba(148,163,184,0.12)] backdrop-blur-xl md:p-7">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-3xl">
                    <div className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-violet-700">
                      {navItems.find((item) => item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href))
                        ?.description ?? "作品工作台"}
                    </div>
                    <h1 className="mt-4 text-[2rem] font-semibold tracking-[-0.03em] text-slate-900 md:text-[2.3rem]">
                      {title}
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-[15px]">
                      {description}
                    </p>
                  </div>

                  {highlight ? (
                    <div className="w-full max-w-sm rounded-[1.7rem] border border-violet-100 bg-violet-50/80 p-5 shadow-sm">
                      <div className="text-xs font-semibold tracking-[0.08em] text-violet-700">
                        {highlight.label}
                      </div>
                      <div className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-900">
                        {highlight.value}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{highlight.hint}</p>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {children}
          </main>
        </div>
      </div>

      {/* 关于这个作品 弹窗 */}
      {aboutOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.22)] backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-violet-700">
                  作品说明
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-slate-900">
                  关于 MyFlow OS
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-violet-200 hover:text-violet-700"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-5 text-sm leading-7 text-slate-600">
              <p>
                这是一个面向「即将毕业、方向还在探索」阶段的 AI 秘书工作台。它把月历放在第一屏，
                让你一眼看清这个月的关键安排；邮件会被自动拆解成任务、提醒和日程变化，
                帮你在求职与生活之间守住节奏。
              </p>

              <div>
                <div className="text-xs font-semibold tracking-[0.08em] text-slate-400">
                  核心模块
                </div>
                <ul className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    "月历优先首页",
                    "自然语言加日程",
                    "任务中心",
                    "日 / 周 / 月计划",
                    "邮件智能中心",
                    "每周回顾调整",
                  ].map((m) => (
                    <li
                      key={m}
                      className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-slate-700"
                    >
                      {m}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-xs font-semibold tracking-[0.08em] text-slate-400">
                  技术栈
                </div>
                <p className="mt-2">
                  Next.js 16 · TypeScript · Tailwind CSS · LocalStorage 持久化 ·
                  SharedWorker 跨页通信
                </p>
              </div>

              <div>
                <div className="text-xs font-semibold tracking-[0.08em] text-slate-400">
                  设计决策
                </div>
                <ul className="mt-2 space-y-1.5">
                  <li>· 玻璃气泡模块化，颜色小圆点代替文字标签</li>
                  <li>· 所有目标定位高亮 2.8s 自动淡出</li>
                  <li>· 月历只放重要不重复的安排，日常习惯留给当日流程</li>
                </ul>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAboutOpen(false)}
              className="mt-6 w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              知道了
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
