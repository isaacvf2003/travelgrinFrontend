import { useState, useEffect } from "react";
import StatCard from "../components/dashboard/StatCard";
import StatsChart from "../components/dashboard/StatsChart";
import CategoriasTable from "../components/dashboard/CategoriasTable";
import PaisesTable from "../components/dashboard/PaisesTable";
import VisitasTable from "../components/dashboard/VisitasTable";
import { AlertTriangle } from "lucide-react";

export default function Panel() {
  const [usuarios, setUsuarios] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);

  useEffect(() => {
    base44.entities.Usuario.list().then(setUsuarios).catch(() => {});
    base44.entities.Publicacion.list().then(setPublicaciones).catch(() => {});
  }, []);

  const oferentes = usuarios.filter(u => u.tipo === "Oferente");
  const demandantes = usuarios.filter(u => u.tipo === "Demandante");
  const pubActivas = publicaciones.filter(p => p.estado === "Activo");
  const pubPagas = publicaciones.filter(p => p.tipo === "Paga");
  const pubGratis = publicaciones.filter(p => p.tipo === "Gratis");

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Usuarios Oferentes"
          total={oferentes.length || 122}
          activos={Math.floor((oferentes.length || 122) * 0.8)}
          enMes={11}
          activosMes={18}
          color="blue"
        />
        <StatCard
          label="Usuarios Demandantes"
          total={demandantes.length || 1010}
          activos={Math.floor((demandantes.length || 1010) * 0.37)}
          enMes={22}
          activosMes={375}
          color="violet"
        />
        <StatCard
          label="Publicaciones Activas"
          total={publicaciones.length || 278}
          activos={pubActivas.length || 250}
          enMes={3}
          activosMes={87}
          color="emerald"
        />
        <div className="rounded-2xl border bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200 text-rose-700 p-5 flex flex-col gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-semibold uppercase tracking-widest opacity-70">Reportes / Denuncias</span>
          </div>
          <div className="flex items-end justify-between mt-1">
            <div>
              <p className="text-4xl font-bold tracking-tight">10</p>
              <p className="text-xs mt-1 opacity-60">en el mes</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold">9</p>
              <p className="text-xs opacity-60">usuarios afectados</p>
            </div>
          </div>
          <div className="flex gap-4 mt-2 pt-2 border-t border-rose-200 text-xs">
            <span>+ 22 acumulado</span>
          </div>
        </div>
      </div>

      {/* Stats Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <StatsChart title="Oferentes: activos vs inactivos" label1="Activos" label2="Inactivos" color1="#6366f1" color2="#c7d2fe" seed={1} />
        <StatsChart title="Demandantes: activos vs inactivos" label1="Activos" label2="Inactivos" color1="#8b5cf6" color2="#ddd6fe" seed={2} />
        <StatsChart title="Publicaciones: pagas vs gratis" label1="Pagas" label2="Gratis" color1="#10b981" color2="#a7f3d0" seed={3} />
        <StatsChart title="Denuncias por período" label1="Denuncias" color1="#f43f5e" color2="#fecdd3" seed={4} singleSerie />
      </div>

      {/* Publicaciones por tipo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-1">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Total Publicaciones</p>
          <p className="text-3xl font-bold text-slate-800">{publicaciones.length || 278}</p>
        </div>
        <div className="bg-violet-50 rounded-2xl border border-violet-100 shadow-sm p-5 flex flex-col gap-1">
          <p className="text-xs text-violet-500 uppercase tracking-widest font-semibold">Pagas</p>
          <p className="text-3xl font-bold text-violet-700">{pubPagas.length || 250}</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm p-5 flex flex-col gap-1">
          <p className="text-xs text-emerald-500 uppercase tracking-widest font-semibold">Gratis</p>
          <p className="text-3xl font-bold text-emerald-700">{pubGratis.length || 28}</p>
        </div>
      </div>

      {/* Categorías */}
      <CategoriasTable />

      {/* Países */}
      <PaisesTable />

      {/* Visitas */}
      <VisitasTable />
    </div>
  );
}