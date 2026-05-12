import TravelgrinLoadingScreen from "@/components/TravelgrinLoadingScreen";

export default function PrestacionDetailLoading() {
  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="h-12 w-2/3 animate-pulse rounded-xl bg-slate-300/55" />
        <div className="mt-6 space-y-4">
          <div className="h-80 animate-pulse rounded-2xl bg-slate-300/50" />
          <div className="h-52 animate-pulse rounded-2xl bg-slate-300/45" />
          <div className="h-52 animate-pulse rounded-2xl bg-slate-300/45" />
        </div>
      </main>
      <TravelgrinLoadingScreen />
    </>
  );
}
