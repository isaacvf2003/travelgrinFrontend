import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function StatCard({ label, total, activos, enMes, activosMes, color = "blue" }) {
  const colorMap = {
    blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
    emerald: "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700",
    violet: "from-violet-50 to-violet-100 border-violet-200 text-violet-700",
    rose: "from-rose-50 to-rose-100 border-rose-200 text-rose-700",
  };

  const dotColor = {
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    violet: "bg-violet-500",
    rose: "bg-rose-500",
  };

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${colorMap[color]} p-5 flex flex-col gap-2 shadow-sm`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColor[color]}`} />
        <span className="text-xs font-semibold uppercase tracking-widest opacity-70">{label}</span>
      </div>
      <div className="flex items-end justify-between mt-1">
        <div>
          <p className="text-4xl font-bold tracking-tight">{total?.toLocaleString()}</p>
          <p className="text-xs mt-1 opacity-60">en sistema</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold">{activos?.toLocaleString()}</p>
          <p className="text-xs opacity-60">activos</p>
        </div>
      </div>
      <div className="flex gap-4 mt-2 pt-2 border-t border-black/10 text-xs">
        <div className="flex items-center gap-1">
          <ArrowUpRight className="w-3 h-3" />
          <span>+{enMes} en el mes</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="opacity-60">activos mes: {activosMes}</span>
        </div>
      </div>
    </div>
  );
}