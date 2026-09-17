const PAISES_DESTINO = [
  { pais: "Argentina", total: 500, pagas: 250, gratis: 250, visitas: 150 },
  { pais: "Italia", total: 500, pagas: 250, gratis: 250, visitas: 354 },
  { pais: "Brasil", total: 500, pagas: 250, gratis: 250, visitas: 874 },
  { pais: "España", total: 500, pagas: 250, gratis: 250, visitas: 968 },
  { pais: "Chile", total: 500, pagas: 250, gratis: 250, visitas: 578 },
  { pais: "EEUU", total: 500, pagas: 250, gratis: 250, visitas: 364 },
];

const PAISES_ORIGEN = [
  { pais: "Argentina", publicaciones: 7, pagas: 500, gratis: 250, categorias: 7, destinos: 30 },
  { pais: "Uruguay", publicaciones: 0, pagas: 500, gratis: 250, categorias: 5, destinos: 87 },
  { pais: "Paraguay", publicaciones: 0, pagas: 500, gratis: 250, categorias: 5, destinos: 25 },
  { pais: "Chile", publicaciones: 0, pagas: 500, gratis: 250, categorias: 3, destinos: 25 },
  { pais: "Bolivia", publicaciones: 0, pagas: 500, gratis: 250, categorias: 5, destinos: 54 },
  { pais: "Perú", publicaciones: 0, pagas: 500, gratis: 250, categorias: 2, destinos: 22 },
];

export default function PaisesTable() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Países Destino */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Países Destino (Demandantes)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-400 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-semibold">País</th>
                <th className="text-center px-3 py-3 font-semibold">Total</th>
                <th className="text-center px-3 py-3 font-semibold">Pagas</th>
                <th className="text-center px-3 py-3 font-semibold">Gratis</th>
                <th className="text-center px-3 py-3 font-semibold">Visitas</th>
              </tr>
            </thead>
            <tbody>
              {PAISES_DESTINO.map((p, i) => (
                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-700 font-medium">{p.pais}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{p.total}</td>
                  <td className="px-3 py-3 text-center text-violet-600 font-semibold">{p.pagas}</td>
                  <td className="px-3 py-3 text-center text-emerald-600 font-semibold">{p.gratis}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-bold ${p.visitas > 700 ? 'text-blue-600' : 'text-slate-500'}`}>{p.visitas}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Países Origen */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Países Origen (Oferentes)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-400 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-semibold">País</th>
                <th className="text-center px-3 py-3 font-semibold">Pubs.</th>
                <th className="text-center px-3 py-3 font-semibold">Pagas</th>
                <th className="text-center px-3 py-3 font-semibold">Gratis</th>
                <th className="text-center px-3 py-3 font-semibold">Cats.</th>
                <th className="text-center px-3 py-3 font-semibold">Destinos</th>
              </tr>
            </thead>
            <tbody>
              {PAISES_ORIGEN.map((p, i) => (
                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-700 font-medium">{p.pais}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{p.publicaciones}</td>
                  <td className="px-3 py-3 text-center text-violet-600 font-semibold">{p.pagas}</td>
                  <td className="px-3 py-3 text-center text-emerald-600 font-semibold">{p.gratis}</td>
                  <td className="px-3 py-3 text-center text-slate-500">{p.categorias}</td>
                  <td className="px-3 py-3 text-center font-semibold text-blue-600">{p.destinos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}