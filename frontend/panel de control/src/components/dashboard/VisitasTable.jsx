const VISITAS = [
  { pais: "Argentina", total: 167877, porDia: 100, porMes: 25476, destinos: 3 },
  { pais: "Uruguay", total: 800, porDia: 250, porMes: 250, destinos: 6 },
  { pais: "Alemania", total: 800, porDia: 250, porMes: 250, destinos: 3 },
  { pais: "España", total: 800, porDia: 250, porMes: 250, destinos: 3 },
  { pais: "EEUU", total: 500, porDia: 250, porMes: 250, destinos: 5 },
  { pais: "Perú", total: 500, porDia: 250, porMes: 250, destinos: 2 },
];

export default function VisitasTable() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700">Visitas por Pasaporte / País de Origen</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-semibold">País</th>
              <th className="text-center px-3 py-3 font-semibold">Total</th>
              <th className="text-center px-3 py-3 font-semibold">Prom. por Día</th>
              <th className="text-center px-3 py-3 font-semibold">Prom. por Mes</th>
              <th className="text-center px-3 py-3 font-semibold">Destinos Prom.</th>
            </tr>
          </thead>
          <tbody>
            {VISITAS.map((v, i) => (
              <tr key={i} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 text-slate-700 font-medium">{v.pais}</td>
                <td className="px-3 py-3 text-center font-bold text-blue-600">{v.total.toLocaleString()}</td>
                <td className="px-3 py-3 text-center text-slate-600">{v.porDia}</td>
                <td className="px-3 py-3 text-center text-slate-600">{v.porMes.toLocaleString()}</td>
                <td className="px-3 py-3 text-center text-slate-500">{v.destinos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}