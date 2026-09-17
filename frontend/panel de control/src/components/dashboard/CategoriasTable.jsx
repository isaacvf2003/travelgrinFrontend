const CATEGORIAS = [
  { nombre: "Gestiones migratorias y visas", total: 500, pagas: 250, gratis: 250, destino: 9 },
  { nombre: "Educación y centros de estudios", total: 500, pagas: 250, gratis: 250, destino: 9 },
  { nombre: "Empleos temporales", total: 500, pagas: 250, gratis: 250, destino: 9 },
  { nombre: "Centros médicos salud y bienestar", total: 500, pagas: 250, gratis: 250, destino: 9 },
  { nombre: "Voluntariado y centros de ayuda", total: 500, pagas: 250, gratis: 250, destino: 9 },
  { nombre: "Deportes y entretenimiento", total: 500, pagas: 250, gratis: 250, destino: 9 },
];

export default function CategoriasTable() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700">Categorías</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-semibold">Categoría</th>
              <th className="text-center px-3 py-3 font-semibold">Total</th>
              <th className="text-center px-3 py-3 font-semibold">Pagas</th>
              <th className="text-center px-3 py-3 font-semibold">Gratis</th>
              <th className="text-center px-3 py-3 font-semibold">En País Destino</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIAS.map((cat, i) => (
              <tr key={i} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 text-slate-700 font-medium">{cat.nombre}</td>
                <td className="px-3 py-3 text-center text-slate-600">{cat.total}</td>
                <td className="px-3 py-3 text-center">
                  <span className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">{cat.pagas}</span>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">{cat.gratis}</span>
                </td>
                <td className="px-3 py-3 text-center text-slate-500">{cat.destino}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}