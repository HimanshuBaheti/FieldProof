export type Role = "farmer" | "verifier" | "processor";

const TABS: { id: Role; label: string; hint: string }[] = [
  { id: "farmer", label: "Farmer", hint: "Submit an action" },
  { id: "verifier", label: "Verifier", hint: "Check & mint" },
  { id: "processor", label: "Processor", hint: "Buy & retire" },
];

export default function RoleTabs({
  role,
  onChange,
  counts,
}: {
  role: Role;
  onChange: (r: Role) => void;
  counts: Record<Role, number>;
}) {
  return (
    <nav className="flex gap-2 rounded-2xl bg-stone-200/70 p-1.5" role="tablist">
      {TABS.map((t) => {
        const active = t.id === role;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`flex flex-1 items-center justify-center gap-3 rounded-xl px-5 py-3 text-lg font-semibold transition ${
              active ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:bg-white/60"
            }`}
          >
            {t.label}
            <span className="hidden text-sm font-normal text-stone-500 lg:inline">{t.hint}</span>
            {counts[t.id] > 0 && (
              <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-sm text-white">
                {counts[t.id]}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
