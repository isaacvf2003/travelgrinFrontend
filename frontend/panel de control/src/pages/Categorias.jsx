import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronRight, ChevronDown, Edit2, Tag } from "lucide-react";

const TYPEFORMS = ["voluntario", "destino", "prestacion", "predeterminado"];
const TYPEFORM_COLORS = {
  voluntario: "bg-emerald-100 text-emerald-700",
  destino: "bg-blue-100 text-blue-700",
  prestacion: "bg-violet-100 text-violet-700",
  predeterminado: "bg-slate-100 text-slate-600",
};
const IDIOMAS = ["es", "en", "pt", "it"];
const IDIOMA_LABELS = { es: "Español", en: "English", pt: "Português", it: "Italiano" };

const emptyForm = { nombre_es: "", nombre_en: "", nombre_pt: "", nombre_it: "", typeform: "predeterminado", parent_id: "", activa: true, orden: 0 };

export default function Categorias() {
  const [categorias, setCategorias] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editando, setEditando] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [activeLang, setActiveLang] = useState("es");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    base44.entities.CategoriaAdmin.list().then(setCategorias).catch(() => {});
  }, []);

  const padres = categorias.filter(c => !c.parent_id);
  const hijosOf = (id) => categorias.filter(c => c.parent_id === id);

  const openNew = (parentId = "") => {
    setForm({ ...emptyForm, parent_id: parentId });
    setEditando(null);
    setShowForm(true);
  };

  const openEdit = (cat) => {
    setForm({ ...cat });
    setEditando(cat.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    setLoading(true);
    if (editando) {
      const updated = await base44.entities.CategoriaAdmin.update(editando, form);
      setCategorias(prev => prev.map(c => c.id === editando ? updated : c));
    } else {
      const created = await base44.entities.CategoriaAdmin.create(form);
      setCategorias(prev => [...prev, created]);
    }
    setLoading(false);
    setShowForm(false);
    setForm(emptyForm);
    setEditando(null);
  };

  const nombre = (cat) => cat[`nombre_${activeLang}`] || cat.nombre_es || "(sin nombre)";

  return (
    <div className="space-y-6">
      {/* Lang + New button header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {IDIOMAS.map(l => (
            <button key={l} onClick={() => setActiveLang(l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeLang === l ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2" onClick={() => openNew()}>
          <Plus className="w-4 h-4" /> Nueva Categoría Raíz
        </Button>
      </div>

      {/* Category tree */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Árbol de Categorías</h3>
          <span className="text-xs text-slate-400">{padres.length} raíz · {categorias.length - padres.length} subcategorías</span>
        </div>

        {categorias.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay categorías aún</p>
            <Button variant="outline" className="mt-3 gap-1" onClick={() => openNew()}>
              <Plus className="w-4 h-4" /> Crear primera categoría
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {padres.map(cat => {
              const hijos = hijosOf(cat.id);
              const isOpen = expanded[cat.id];
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 group">
                    <button onClick={() => setExpanded(e => ({ ...e, [cat.id]: !e[cat.id] }))}
                      className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600">
                      {hijos.length > 0
                        ? (isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)
                        : <span className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800">{nombre(cat)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPEFORM_COLORS[cat.typeform]}`}>{cat.typeform}</span>
                        {!cat.activa && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactiva</span>}
                        {hijos.length > 0 && <span className="text-xs text-slate-400">{hijos.length} sub</span>}
                      </div>
                      <div className="flex gap-2 mt-0.5">
                        {IDIOMAS.map(l => cat[`nombre_${l}`] && (
                          <span key={l} className="text-xs text-slate-400">{l}: {cat[`nombre_${l}`]}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => openNew(cat.id)}>
                        <Plus className="w-3 h-3" /> Sub
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openEdit(cat)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Subcategories */}
                  {isOpen && hijos.map(hijo => (
                    <div key={hijo.id} className="flex items-center gap-3 px-5 py-3 pl-14 bg-slate-50/60 hover:bg-slate-50 border-t border-slate-100 group">
                      <div className="w-4 h-px bg-slate-200 mr-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-slate-700 font-medium">{nombre(hijo)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPEFORM_COLORS[hijo.typeform]}`}>{hijo.typeform}</span>
                          {!hijo.activa && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactiva</span>}
                        </div>
                        <div className="flex gap-2 mt-0.5">
                          {IDIOMAS.map(l => hijo[`nombre_${l}`] && (
                            <span key={l} className="text-xs text-slate-400">{l}: {hijo[`nombre_${l}`]}</span>
                          ))}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(hijo)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Categoría" : form.parent_id ? "Nueva Subcategoría" : "Nueva Categoría"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Nombres multilenguaje */}
            <div>
              <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Nombre (multilenguaje)</Label>
              <div className="space-y-2">
                {IDIOMAS.map(l => (
                  <div key={l} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 w-6 uppercase">{l}</span>
                    <Input
                      value={form[`nombre_${l}`] || ""}
                      onChange={e => setForm(f => ({ ...f, [`nombre_${l}`]: e.target.value }))}
                      placeholder={`Nombre en ${IDIOMA_LABELS[l]}`}
                      className="flex-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* TypeForm */}
            <div>
              <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">TypeForm</Label>
              <Select value={form.typeform} onValueChange={v => setForm(f => ({ ...f, typeform: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="voluntario">Voluntario</SelectItem>
                  <SelectItem value="destino">Destino</SelectItem>
                  <SelectItem value="prestacion">Prestación</SelectItem>
                  <SelectItem value="predeterminado">Predeterminado (hereda del padre)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1">
                {form.typeform === "predeterminado" ? "Esta subcategoría adoptará el TypeForm de su categoría padre." : `TypeForm: ${form.typeform}`}
              </p>
            </div>

            {/* Parent */}
            {!editando && (
              <div>
                <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">Categoría Padre</Label>
                <Select value={form.parent_id || "__none__"} onValueChange={v => setForm(f => ({ ...f, parent_id: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(Ninguna — categoría raíz)</SelectItem>
                    {padres.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre_es || p.nombre_en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Estado */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="activa"
                checked={form.activa}
                onChange={e => setForm(f => ({ ...f, activa: e.target.checked }))}
                className="w-4 h-4 accent-indigo-600"
              />
              <Label htmlFor="activa" className="text-sm cursor-pointer">Categoría activa</Label>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={loading || !form.nombre_es} className="bg-indigo-600 hover:bg-indigo-700">
                {loading ? "Guardando..." : editando ? "Actualizar" : "Crear Categoría"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}