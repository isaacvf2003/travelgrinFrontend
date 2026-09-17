import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MultiLangField from "../components/publicaciones/MultiLangField";
import EtiquetasBlock from "../components/publicaciones/EtiquetasBlock";
import TarjetasRecursos from "../components/publicaciones/TarjetasRecursos";
import BloqueTextoColor from "../components/publicaciones/BloqueTextoColor";
import { PasosEditor, FAQsEditor } from "../components/publicaciones/PasosYFAQs";
import { Plus, Trash2, ChevronLeft, Star, Image } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

const TYPEFORMS = ["voluntario", "destino", "prestacion", "predeterminado"];
const MONEDAS = ["ARS", "USD", "EUR", "BRL", "CLP", "UYU", "MXN"];
const PERIODOS = ["por día", "por semana", "por mes", "por año", "único"];
const IDIOMAS_OPCIONES = ["Español", "Inglés", "Portugués", "Italiano", "Francés", "Alemán"];
const TIPO_TURISMO = ["Receptivo (recibe viajeros)", "Emisivo (intermediarios/agencias)"];

const emptyForm = {
  tipo_publicacion: "publicacion",
  idioma_edicion: "es",
  titulo_es: "", titulo_en: "", titulo_pt: "", titulo_it: "",
  nombre_oferente: "",
  estado: "Borrador",
  descripcion_es: "", descripcion_en: "", descripcion_pt: "", descripcion_it: "",
  bloques_descripcion: [],
  desc_oferente_es: "", desc_oferente_en: "",
  logo_oferente: "",
  inicio_actividad: "",
  valoracion: "",
  comentarios_count: 0,
  link_comentarios: "",
  actividades: [],
  tipos: [],
  origen: "",
  typeform: "prestacion",
  categoria_id: "",
  subcategoria_id: "",
  destacado: false,
  pais_destino: "",
  ciudad_destino: "",
  url_maps: "",
  moneda: "USD",
  precio: "",
  periodo_precio: "por mes",
  precios_adicionales: [],
  pais_sede: "",
  ciudad_sede: "",
  maps_sede: "",
  sedes_adicionales: [],
  filtro_pasaporte: "todos",
  idioma_publicacion: "Español",
  idiomas_hablan: "es",
  tipo_turismo: "Receptivo (recibe viajeros)",
  expira: "",
  pagina_web: "",
  imagenes: [],
  redes_sociales: [],
  etiquetas_tipo_perfil: [],
  etiquetas_actividad: [],
  etiquetas_modalidad: [],
  etiquetas_vinculo: [],
  etiquetas_idiomas: [],
  etiquetas_incluye: [],
};

const SectionTitle = ({ children }) => (
  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest pt-4 pb-1 border-b border-slate-100">{children}</h3>
);

export default function NuevaPublicacion() {
  const [form, setForm] = useState(emptyForm);
  const [categorias, setCategorias] = useState([]);
  const [saving, setSaving] = useState(false);
  const [newImgUrl, setNewImgUrl] = useState("");
  const [newActividad, setNewActividad] = useState("");
  const [newTipo, setNewTipo] = useState("");
  const [newRedNombre, setNewRedNombre] = useState("");
  const [newRedUrl, setNewRedUrl] = useState("");
  const [newPrecioMoneda, setNewPrecioMoneda] = useState("USD");
  const [newPrecioValor, setNewPrecioValor] = useState("");
  const [newSedeP, setNewSedeP] = useState("");
  const [newSedeC, setNewSedeC] = useState("");
  const [newSedeM, setNewSedeM] = useState("");

  useEffect(() => {
    base44.entities.CategoriaAdmin.list().then(setCategorias).catch(() => {});
  }, []);

  const padres = categorias.filter(c => !c.parent_id);
  const subcats = categorias.filter(c => c.parent_id === form.categoria_id);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.PublicacionAdmin.create(form);
    setSaving(false);
    window.location.href = createPageUrl("Publicaciones");
  };

  const addBloque = () => setForm(f => ({ ...f, bloques_descripcion: [...f.bloques_descripcion, { titulo: "", texto: "" }] }));
  const removeBloque = (i) => setForm(f => ({ ...f, bloques_descripcion: f.bloques_descripcion.filter((_, idx) => idx !== i) }));
  const updateBloque = (i, key, val) => setForm(f => {
    const bl = [...f.bloques_descripcion];
    bl[i] = { ...bl[i], [key]: val };
    return { ...f, bloques_descripcion: bl };
  });

  const addImg = () => { if (newImgUrl.trim()) { setForm(f => ({ ...f, imagenes: [...f.imagenes, newImgUrl.trim()] })); setNewImgUrl(""); } };
  const removeImg = (i) => setForm(f => ({ ...f, imagenes: f.imagenes.filter((_, idx) => idx !== i) }));

  const addActividad = () => { if (newActividad.trim()) { setForm(f => ({ ...f, actividades: [...f.actividades, newActividad.trim()] })); setNewActividad(""); } };
  const addTipo = () => { if (newTipo.trim()) { setForm(f => ({ ...f, tipos: [...f.tipos, newTipo.trim()] })); setNewTipo(""); } };

  const addRed = () => { if (newRedNombre && newRedUrl) { setForm(f => ({ ...f, redes_sociales: [...f.redes_sociales, { nombre: newRedNombre, url: newRedUrl }] })); setNewRedNombre(""); setNewRedUrl(""); } };
  const removeRed = (i) => setForm(f => ({ ...f, redes_sociales: f.redes_sociales.filter((_, idx) => idx !== i) }));

  const addPrecio = () => { if (newPrecioValor) { setForm(f => ({ ...f, precios_adicionales: [...f.precios_adicionales, { moneda: newPrecioMoneda, valor: newPrecioValor }] })); setNewPrecioMoneda("USD"); setNewPrecioValor(""); } };
  const removePrecio = (i) => setForm(f => ({ ...f, precios_adicionales: f.precios_adicionales.filter((_, idx) => idx !== i) }));

  const addSede = () => { if (newSedeP) { setForm(f => ({ ...f, sedes_adicionales: [...f.sedes_adicionales, { pais: newSedeP, ciudad: newSedeC, maps: newSedeM }] })); setNewSedeP(""); setNewSedeC(""); setNewSedeM(""); } };
  const removeSede = (i) => setForm(f => ({ ...f, sedes_adicionales: f.sedes_adicionales.filter((_, idx) => idx !== i) }));

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={createPageUrl("Publicaciones")} className="p-2 hover:bg-slate-100 rounded-xl transition">
          <ChevronLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Nueva Publicación</h1>
          <p className="text-xs text-slate-400">Completa todos los campos necesarios</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">

        {/* Tipo de publicación */}
        <div className="flex gap-2">
          {["publicacion", "prestacion"].map(t => (
            <button key={t} onClick={() => setForm(f => ({ ...f, tipo_publicacion: t }))}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${form.tipo_publicacion === t ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}>
              {t === "publicacion" ? "Publicación" : "Prestación"}
            </button>
          ))}
        </div>

        <SectionTitle>Idioma de edición</SectionTitle>
        <div className="flex gap-1">
          {["es", "en", "pt", "it"].map(l => (
            <button key={l} onClick={() => setForm(f => ({ ...f, idioma_edicion: l }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${form.idioma_edicion === l ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <SectionTitle>Información principal</SectionTitle>

        <MultiLangField label="Título" fieldBase="titulo" form={form} setForm={setForm} placeholder="Ej: Acompañamos tu registro..." />

        <div>
          <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Nombre completo del oferente</Label>
          <Input value={form.nombre_oferente} onChange={e => setForm(f => ({ ...f, nombre_oferente: e.target.value }))} placeholder="Ej: Ana Pérez" className="text-sm" />
        </div>

        <div>
          <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Estado</Label>
          <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Activo", "Borrador", "Pausada", "Vencida", "En Revisión", "Suspendida"].map(e => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <MultiLangField label="Descripción" fieldBase="descripcion" form={form} setForm={setForm} multiline placeholder="Texto de la publicación..." />

        {/* Bloques descripción */}
        <div>
          <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Descripciones adicionales</Label>
          {form.bloques_descripcion.map((b, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3 mb-2 space-y-2">
              <div className="flex items-center gap-2">
                <Input value={b.titulo} onChange={e => updateBloque(i, "titulo", e.target.value)} placeholder="Título del bloque" className="text-sm flex-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => removeBloque(i)}><Trash2 className="w-4 h-4" /></Button>
              </div>
              <Textarea value={b.texto} onChange={e => updateBloque(i, "texto", e.target.value)} placeholder="Texto del bloque..." className="text-sm min-h-[70px]" />
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addBloque}><Plus className="w-3 h-3" /> Agregar bloque</Button>
        </div>

        <SectionTitle>Información del oferente</SectionTitle>

        <MultiLangField label="Descripción del oferente" fieldBase="desc_oferente" form={form} setForm={setForm} multiline placeholder="Texto visible en el detalle..." />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Logo del oferente (URL)</Label>
            <Input value={form.logo_oferente} onChange={e => setForm(f => ({ ...f, logo_oferente: e.target.value }))} placeholder="https://..." className="text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Inicio de actividad (año)</Label>
            <Input type="number" value={form.inicio_actividad} onChange={e => setForm(f => ({ ...f, inicio_actividad: e.target.value }))} placeholder="2010" className="text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Valoración (0 a 5)</Label>
            <Input type="number" min="0" max="5" step="0.1" value={form.valoracion} onChange={e => setForm(f => ({ ...f, valoracion: e.target.value }))} placeholder="4" className="text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Cantidad de comentarios</Label>
            <Input type="number" value={form.comentarios_count} onChange={e => setForm(f => ({ ...f, comentarios_count: Number(e.target.value) }))} placeholder="0" className="text-sm" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Link a comentarios</Label>
            <Input value={form.link_comentarios} onChange={e => setForm(f => ({ ...f, link_comentarios: e.target.value }))} placeholder="https://..." className="text-sm" />
          </div>
        </div>

        {/* Actividad */}
        <div>
          <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Actividad</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {form.actividades.map((a, i) => (
              <span key={i} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-full">
                {a} <button onClick={() => setForm(f => ({ ...f, actividades: f.actividades.filter((_, j) => j !== i) }))} className="text-slate-400 hover:text-red-500 ml-0.5">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newActividad} onChange={e => setNewActividad(e.target.value)} placeholder="Ej: Salud y bienestar" className="text-sm flex-1" onKeyDown={e => e.key === "Enter" && addActividad()} />
            <Button variant="outline" size="sm" onClick={addActividad}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>

        {/* Tipo */}
        <div>
          <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Tipo</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {form.tipos.map((t, i) => (
              <span key={i} className="flex items-center gap-1 bg-violet-100 text-violet-700 text-xs px-2 py-1 rounded-full">
                {t} <button onClick={() => setForm(f => ({ ...f, tipos: f.tipos.filter((_, j) => j !== i) }))} className="text-violet-400 hover:text-red-500 ml-0.5">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newTipo} onChange={e => setNewTipo(e.target.value)} placeholder="Ej: Empresa privada" className="text-sm flex-1" onKeyDown={e => e.key === "Enter" && addTipo()} />
            <Button variant="outline" size="sm" onClick={addTipo}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>

        <div>
          <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Origen (país base del oferente)</Label>
          <Input value={form.origen} onChange={e => setForm(f => ({ ...f, origen: e.target.value }))} placeholder="España" className="text-sm" />
        </div>

        <SectionTitle>Propuesta / Publicación</SectionTitle>

        <div>
          <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">TypeForm</Label>
          <Select value={form.typeform} onValueChange={v => setForm(f => ({ ...f, typeform: v, categoria_id: "", subcategoria_id: "" }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPEFORMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-400 mt-1">Filtra categorías según el TypeForm seleccionado</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Categoría</Label>
            <Select value={form.categoria_id || "__none__"} onValueChange={v => setForm(f => ({ ...f, categoria_id: v === "__none__" ? "" : v, subcategoria_id: "" }))}>
              <SelectTrigger><SelectValue placeholder="Elegir categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">(Sin categoría)</SelectItem>
                {padres.filter(c => c.typeform === form.typeform || form.typeform === "predeterminado").map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre_es}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Subcategoría</Label>
            <Select value={form.subcategoria_id || "__none__"} onValueChange={v => setForm(f => ({ ...f, subcategoria_id: v === "__none__" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Elegir subcategoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">(Sin subcategoría)</SelectItem>
                {subcats.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre_es}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="destacado" checked={form.destacado} onChange={e => setForm(f => ({ ...f, destacado: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
          <Label htmlFor="destacado" className="text-sm cursor-pointer flex items-center gap-1"><Star className="w-3 h-3 text-amber-500" /> Destacado</Label>
        </div>

        <SectionTitle>Destino del viaje</SectionTitle>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">País</Label>
            <Input value={form.pais_destino} onChange={e => setForm(f => ({ ...f, pais_destino: e.target.value }))} placeholder="Argentina" className="text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Ciudad</Label>
            <Input value={form.ciudad_destino} onChange={e => setForm(f => ({ ...f, ciudad_destino: e.target.value }))} placeholder="Ciudad de Mendoza" className="text-sm" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">URL Google Maps</Label>
            <Input value={form.url_maps} onChange={e => setForm(f => ({ ...f, url_maps: e.target.value }))} placeholder="https://maps.google.com/..." className="text-sm" />
          </div>
        </div>

        <SectionTitle>Precio</SectionTitle>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Moneda</Label>
            <Select value={form.moneda} onValueChange={v => setForm(f => ({ ...f, moneda: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MONEDAS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Precio</Label>
            <Input value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} placeholder="150000 o 'Precio a convenir'" className="text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Período</Label>
            <Select value={form.periodo_precio} onValueChange={v => setForm(f => ({ ...f, periodo_precio: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PERIODOS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* Precios adicionales */}
        <div>
          <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Precios por moneda adicionales</Label>
          {form.precios_adicionales.map((p, i) => (
            <div key={i} className="flex items-center gap-2 mb-1 text-sm">
              <span className="font-semibold text-slate-600 w-12">{p.moneda}</span>
              <span className="text-slate-700 flex-1">{p.valor}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => removePrecio(i)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <Select value={newPrecioMoneda} onValueChange={setNewPrecioMoneda}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{MONEDAS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={newPrecioValor} onChange={e => setNewPrecioValor(e.target.value)} placeholder="Valor" className="text-sm flex-1" />
            <Button variant="outline" size="sm" onClick={addPrecio}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>

        <SectionTitle>Sede del oferente</SectionTitle>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">País de la sede</Label>
            <Input value={form.pais_sede} onChange={e => setForm(f => ({ ...f, pais_sede: e.target.value }))} className="text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Ciudad de la sede</Label>
            <Input value={form.ciudad_sede} onChange={e => setForm(f => ({ ...f, ciudad_sede: e.target.value }))} className="text-sm" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Link Google Maps (opcional)</Label>
            <Input value={form.maps_sede} onChange={e => setForm(f => ({ ...f, maps_sede: e.target.value }))} placeholder="https://..." className="text-sm" />
          </div>
        </div>

        {/* Sedes adicionales */}
        <div>
          <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Sedes adicionales</Label>
          {form.sedes_adicionales.map((s, i) => (
            <div key={i} className="flex items-center gap-2 mb-1 text-sm bg-slate-50 rounded-lg px-3 py-1.5">
              <span className="flex-1">{s.pais} · {s.ciudad}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => removeSede(i)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <div className="flex gap-2 mt-2 flex-wrap">
            <Input value={newSedeP} onChange={e => setNewSedeP(e.target.value)} placeholder="País" className="text-sm w-28" />
            <Input value={newSedeC} onChange={e => setNewSedeC(e.target.value)} placeholder="Ciudad" className="text-sm flex-1 min-w-24" />
            <Input value={newSedeM} onChange={e => setNewSedeM(e.target.value)} placeholder="Maps URL" className="text-sm flex-1 min-w-24" />
            <Button variant="outline" size="sm" onClick={addSede}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>

        <SectionTitle>Configuración adicional</SectionTitle>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Filtro por pasaporte</Label>
            <Select value={form.filtro_pasaporte} onValueChange={v => setForm(f => ({ ...f, filtro_pasaporte: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Recibe viajeros de todos los países</SelectItem>
                <SelectItem value="restringido">Restringido (definir)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Idioma de la publicación</Label>
            <Select value={form.idioma_publicacion} onValueChange={v => setForm(f => ({ ...f, idioma_publicacion: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{IDIOMAS_OPCIONES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Idiomas que se hablan (CSV)</Label>
            <Input value={form.idiomas_hablan} onChange={e => setForm(f => ({ ...f, idiomas_hablan: e.target.value }))} placeholder="es, en, it" className="text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Tipo de turismo</Label>
            <Select value={form.tipo_turismo} onValueChange={v => setForm(f => ({ ...f, tipo_turismo: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPO_TURISMO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Expira</Label>
            <Input value={form.expira} onChange={e => setForm(f => ({ ...f, expira: e.target.value }))} placeholder="2026-12-31 o nota interna" className="text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Página web</Label>
            <Input value={form.pagina_web} onChange={e => setForm(f => ({ ...f, pagina_web: e.target.value }))} placeholder="https://" className="text-sm" />
          </div>
        </div>

        {/* Imágenes */}
        <div>
          <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Imágenes (URLs)</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {form.imagenes.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200" onError={e => e.target.style.display='none'} />
                <button onClick={() => removeImg(i)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center">×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newImgUrl} onChange={e => setNewImgUrl(e.target.value)} placeholder="https://..." className="text-sm flex-1" onKeyDown={e => e.key === "Enter" && addImg()} />
            <Button variant="outline" size="sm" onClick={addImg}><Image className="w-3 h-3" /></Button>
          </div>
        </div>

        {/* Redes sociales */}
        <div>
          <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Redes sociales y contacto</Label>
          {form.redes_sociales.map((r, i) => (
            <div key={i} className="flex items-center gap-2 mb-1 text-sm bg-slate-50 rounded-lg px-3 py-1.5">
              <span className="font-semibold text-slate-600 w-20">{r.nombre}</span>
              <span className="flex-1 text-slate-500 truncate">{r.url}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => removeRed(i)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <Input value={newRedNombre} onChange={e => setNewRedNombre(e.target.value)} placeholder="Nombre (Instagram...)" className="text-sm w-36" />
            <Input value={newRedUrl} onChange={e => setNewRedUrl(e.target.value)} placeholder="URL" className="text-sm flex-1" />
            <Button variant="outline" size="sm" onClick={addRed}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>

        <SectionTitle>Tarjetas de Recursos</SectionTitle>
        <p className="text-xs text-slate-400">Tarjetas flexibles con título, subtítulo, imagen, ítems check y botones de afiliado (máx 2 por tarjeta). Se adaptan al contenido que tengan.</p>
        <TarjetasRecursos form={form} setForm={setForm} />

        <SectionTitle>Bloques de texto con color</SectionTitle>
        <p className="text-xs text-slate-400">Bloques de texto con color de fondo y texto personalizable para destacar secciones.</p>
        <BloqueTextoColor form={form} setForm={setForm} />

        <SectionTitle>Pasos de uso / Cómo funciona</SectionTitle>
        <p className="text-xs text-slate-400">Guía paso a paso que se muestra en la pantalla de detalle.</p>
        <PasosEditor form={form} setForm={setForm} />

        <SectionTitle>Preguntas frecuentes (FAQs)</SectionTitle>
        <p className="text-xs text-slate-400">Se muestran como acordeón en la pantalla de detalle.</p>
        <FAQsEditor form={form} setForm={setForm} />

        <SectionTitle>Etiquetas de filtrado</SectionTitle>

        <EtiquetasBlock label="Tipo de perfil" opciones={["Independiente", "Privado", "Público"]} field="etiquetas_tipo_perfil" form={form} setForm={setForm} />
        <EtiquetasBlock label="Actividad que pertenece" opciones={["Educación", "Servicios Profesionales y Técnicos", "Salud", "Turismo", "Tecnología"]} field="etiquetas_actividad" form={form} setForm={setForm} />
        <EtiquetasBlock label="Modalidad de contacto" opciones={["Online", "Presencial", "Híbrida"]} field="etiquetas_modalidad" form={form} setForm={setForm} />
        <EtiquetasBlock label="Vínculo con Destino" opciones={["Anfitrión", "Intermediario", "Local"]} field="etiquetas_vinculo" form={form} setForm={setForm} />
        <EtiquetasBlock label="Idiomas que hablan" opciones={["Español", "Inglés", "Italiano", "Portugués", "Francés", "Alemán"]} field="etiquetas_idiomas" form={form} setForm={setForm} />
        <EtiquetasBlock label="Incorpora en la propuesta" opciones={["Seguro de viaje", "Alojamiento", "Comida o supermercado", "Impuesto y Fiscalidad", "Transporte"]} field="etiquetas_incluye" form={form} setForm={setForm} />

        {/* Guardar */}
        <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
          <Link to={createPageUrl("Publicaciones")}>
            <Button variant="outline">Cancelar</Button>
          </Link>
          <Button onClick={handleSave} disabled={saving || !form.titulo_es} className="bg-indigo-600 hover:bg-indigo-700 px-8">
            {saving ? "Guardando..." : "Crear publicación"}
          </Button>
        </div>
      </div>
    </div>
  );
}