import { ReactNode } from "react";

type SectionCardProps = {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
};

export function SectionCard({
  id,
  title,
  description,
  children,
  aside,
  className,
}: SectionCardProps) {
  return (
    <section
      id={id}
      className={`rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_16px_38px_rgba(148,163,184,0.12)] backdrop-blur-xl ${
        className ?? ""
      }`}
    >
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
        {aside ? <div>{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "high" | "medium" | "low" | "danger" | "success";
}) {
  const tones: Record<string, string> = {
    default: "bg-slate-100 text-slate-600",
    high: "bg-rose-100 text-rose-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-emerald-100 text-emerald-700",
    danger: "bg-rose-100 text-rose-700",
    success: "bg-emerald-100 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
        tones[tone]
      }`}
    >
      {children}
    </span>
  );
}
