export default function Header({ mock }: { mock: boolean }) {
  return (
    <header className="flex items-start justify-between gap-6 border-b border-stone-200 pb-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-stone-900">
          Field<span className="text-emerald-700">Proof</span>
        </h1>
        <p className="mt-2 text-xl text-stone-600">
          Verified farm climate actions, paid once, counted once.
        </p>
      </div>
      {mock ? (
        <span className="mt-1 shrink-0 rounded-full bg-amber-100 px-4 py-2 text-base font-semibold text-amber-900 ring-1 ring-amber-300">
          ● Mock mode
        </span>
      ) : (
        <span className="mt-1 shrink-0 rounded-full bg-emerald-100 px-4 py-2 text-base font-semibold text-emerald-900 ring-1 ring-emerald-400">
          ● Solana devnet
        </span>
      )}
    </header>
  );
}
