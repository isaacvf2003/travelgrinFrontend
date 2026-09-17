import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function genData(seed) {
  return MONTHS.slice(0, 6).map((m, i) => ({
    mes: m,
    activos: Math.floor(Math.sin(i + seed) * 30 + 60 + seed * 5),
    inactivos: Math.floor(Math.cos(i + seed) * 15 + 30),
  }));
}

export default function MiniBarChart({ title, seed = 1, color1 = "#6366f1", color2 = "#e2e8f0" }) {
  const data = genData(seed);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
      <p className="text-xs text-slate-400 mb-3 font-medium">{title}</p>
      <ResponsiveContainer width="100%" height={90}>
        <BarChart data={data} barSize={8} barGap={2}>
          <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Bar dataKey="activos" fill={color1} radius={[3, 3, 0, 0]} />
          <Bar dataKey="inactivos" fill={color2} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}