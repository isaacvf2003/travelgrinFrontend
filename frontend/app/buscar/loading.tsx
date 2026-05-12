import TravelgrinLoadingScreen from "@/components/TravelgrinLoadingScreen";

export default function BuscarLoading() {
  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 h-12 w-full animate-pulse rounded-xl bg-slate-300/55" />
        <div className="grid gap-6 md:grid-cols-[320px_1fr]">
          <div className="h-[580px] animate-pulse rounded-2xl bg-slate-300/50" />
          <div className="space-y-4">
            <div className="h-14 animate-pulse rounded-xl bg-slate-300/50" />
            <div className="h-44 animate-pulse rounded-2xl bg-slate-300/45" />
            <div className="h-44 animate-pulse rounded-2xl bg-slate-300/45" />
            <div className="h-44 animate-pulse rounded-2xl bg-slate-300/45" />
          </div>
        </div>
      </main>
      <TravelgrinLoadingScreen />
    </>
  );
}
