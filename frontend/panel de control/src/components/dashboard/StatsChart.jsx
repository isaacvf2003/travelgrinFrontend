import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";

const PERIODS = [
  { label: "Días", value: "days" },
  { label: "Semanas", value: "weeks" },
  { label: "Meses", value: "months" },
  { label: "Años", value: "years" },
];

const YEARS = [2024, 2025, 2026];

function generateData(period, year, seed) {
  const rng = (i, s) => Math.floor(Math.sin(i * 2.1 + s) * 40 + 60 + s * 3);
  if (period === "days") {
    return Array.from({ length: 30 }, (_, i) => ({
      label: `${i + 1}`,
      serie1: rng(i, seed),
      serie2: rng(i, seed + 5),
    }));
  }
  if (period === "weeks") {
    return Array.from({ length: 12 }, (_, i) => ({
      label: `S${i + 1}`,
      serie1: rng(i, seed),
      serie2: rng(i, seed + 5),
    }));
  }
  if (period === "months") {
    const m = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return m.map((label, i) => ({
      label,
      serie1: rng(i, seed + year - 2024),
      serie2: rng(i, seed + year - 2024 + 5),
    }));
  }
  if (period === "years") {
    return [2021, 2022, 2023, 2024, 2025, 2026].map((y, i) => ({
      label: `${y}`,
      serie1: rng(i, seed + y - 2021),
      serie2: rng(i, seed + y - 2021 + 5),
    }));
  }
  return [];
}

export default function StatsChart({ title, label1, label2, color1 = "#6366f1", color2 = "#e2e8f0", seed = 1, singleSerie = false }) {
  const [period, setPeriod] = useState("months");
  const [year, setYear] = useState(2025);
  const [chartType, setChartType] = useState("bar");

  const data = generateData(period, year, seed);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <div className="flex items-center gap-1 flex-wrap">
          {/* Chart type */}
          <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setChartType("bar")}
              className={`px-2 py-1 rounded-md font-medium transition-all ${chartType === "bar" ? "bg-white shadow text-slate-700" : "text-slate-400 hover:text-slate-600"}`}
            >Barras</button>
            <button
              onClick={() => setChartType("line")}
              className={`px-2 py-1 rounded-md font-medium transition-all ${chartType === "line" ? "bg-white shadow text-slate-700" : "text-slate-400 hover:text-slate-600"}`}
            >Líneas</button>
          </div>

          {/* Period */}
          <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5 text-xs">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-2 py-1 rounded-md font-medium transition-all ${period === p.value ? "bg-white shadow text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
              >{p.label}</button>
            ))}
          </div>

          {/* Year (only for days/weeks/months) */}
          {period !== "years" && (
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        {chartType === "bar" ? (
          <BarChart data={data} barSize={period === "days" ? 5 : 12} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="serie1" name={label1} fill={color1} radius={[3, 3, 0, 0]} />
            {!singleSerie && <Bar dataKey="serie2" name={label2} fill={color2} radius={[3, 3, 0, 0]} />}
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="serie1" name={label1} stroke={color1} strokeWidth={2} dot={false} />
            {!singleSerie && <Line type="monotone" dataKey="serie2" name={label2} stroke={color2} strokeWidth={2} dot={false} />}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}