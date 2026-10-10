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

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] gap-4 px-3 py-3 md:gap-6 md:px-6 lg:px-8">
        <div className="relative shrink-0">
          {!sidebarOpen ? (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="sticky top-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white/88 text-slate-600 shadow-sm backdrop-blur transition hover:border-violet-200 hover:text-violet-700"
              aria-label="展开导航栏"
            >
              <span className="text-xl leading-none">≡</span>
            </button>
          ) : (
            <aside className="sticky top-3 flex h-[calc(100vh-1.5rem)] w-[11.5rem] flex-col rounded-[2rem] border border-white/70 bg-white/82 p-3 shadow-[0_16px_40px_rgba(148,163,184,0.14)] backdrop-blur-xl md:w-[13.5rem] md:p-4">
              <div className="mb-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg text-slate-500 transition hover:border-violet-200 hover:text-violet-700"
                  aria-label="收起导航栏"
                >
                  ‹
                </button>
              </div>

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
            </aside>
          )}
        </div>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
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
    </div>
  );
}
