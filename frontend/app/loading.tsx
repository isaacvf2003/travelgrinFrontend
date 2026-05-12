import TravelgrinLoadingScreen from "@/components/TravelgrinLoadingScreen";

export default function AppLoading() {
  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="h-24 animate-pulse rounded-3xl bg-slate-300/45" />
        <div className="mt-6 h-56 animate-pulse rounded-3xl bg-slate-300/45" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="h-44 animate-pulse rounded-2xl bg-slate-300/45" />
          <div className="h-44 animate-pulse rounded-2xl bg-slate-300/45" />
          <div className="h-44 animate-pulse rounded-2xl bg-slate-300/45" />
        </div>
      </main>
      <TravelgrinLoadingScreen />
    </>
  );
}
