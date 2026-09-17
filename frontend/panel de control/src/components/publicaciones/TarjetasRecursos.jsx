import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical, Check, Link, Image, X } from "lucide-react";

const emptyTarjeta = {
  titulo: "",
  subtitulo: "",
  imagen_url: "",
  items_check: [],
  botones: [], // [{label, url, estilo: "primario"|"secundario"}]
};

function TarjetaEditor({ tarjeta, onChange, onRemove, index }) {
  const [newItem, setNewItem] = useState("");
  const [newBtnLabel, setNewBtnLabel] = useState("");
  const [newBtnUrl, setNewBtnUrl] = useState("");
  const [newBtnEstilo, setNewBtnEstilo] = useState("primario");

  const addItem = () => {
    if (!newItem.trim()) return;
    onChange({ ...tarjeta, items_check: [...tarjeta.items_check, newItem.trim()] });
    setNewItem("");
  };
  const removeItem = (i) => onChange({ ...tarjeta, items_check: tarjeta.items_check.filter((_, idx) => idx !== i) });

  const addBoton = () => {
    if (!newBtnLabel || !newBtnUrl) return;
    if (tarjeta.botones.length >= 2) return;
    onChange({ ...tarjeta, botones: [...tarjeta.botones, { label: newBtnLabel, url: newBtnUrl, estilo: newBtnEstilo }] });
    setNewBtnLabel(""); setNewBtnUrl(""); setNewBtnEstilo("primario");
  };
  const removeBoton = (i) => onChange({ ...tarjeta, botones: tarjeta.botones.filter((_, idx) => idx !== i) });

  // Preview card
  const hasContent = tarjeta.titulo || tarjeta.subtitulo || tarjeta.imagen_url || tarjeta.items_check.length > 0 || tarjeta.botones.length > 0;

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-slate-300" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tarjeta #{index + 1}</span>
          {tarjeta.titulo && <span className="text-xs text-slate-600 font-medium">— {tarjeta.titulo}</span>}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={onRemove}><X className="w-3.5 h-3.5" /></Button>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-slate-400 mb-1 block">Título</Label>
            <Input value={tarjeta.titulo} onChange={e => onChange({ ...tarjeta, titulo: e.target.value })} placeholder="Ej: Lima Immigration" className="text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-400 mb-1 block">Subtítulo</Label>
            <Input value={tarjeta.subtitulo} onChange={e => onChange({ ...tarjeta, subtitulo: e.target.value })} placeholder="Ej: Tu guía de visa personalizada" className="text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><Image className="w-3 h-3" /> Imagen (URL)</Label>
            <Input value={tarjeta.imagen_url} onChange={e => onChange({ ...tarjeta, imagen_url: e.target.value })} placeholder="https://..." className="text-sm" />
          </div>

          {/* Items check */}
          <div>
            <Label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500" /> Items con check</Label>
            <div className="space-y-1 mb-2">
              {tarjeta.items_check.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-emerald-50 rounded-lg px-2.5 py-1.5">
                  <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  <span className="flex-1">{item}</span>
                  <button onClick={() => removeItem(i)} className="text-slate-300 hover:text-red-400"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()} placeholder="Agregar ítem..." className="text-xs flex-1" />
              <Button size="sm" variant="outline" onClick={addItem} className="h-8"><Plus className="w-3 h-3" /></Button>
            </div>
          </div>

          {/* Botones */}
          <div>
            <Label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><Link className="w-3 h-3" /> Botones ({tarjeta.botones.length}/2)</Label>
            <div className="space-y-1 mb-2">
              {tarjeta.botones.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-indigo-50 rounded-lg px-2.5 py-1.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${b.estilo === "primario" ? "bg-indigo-600 text-white" : "border border-indigo-300 text-indigo-600"}`}>{b.label}</span>
                  <span className="flex-1 truncate text-slate-400">{b.url}</span>
                  <button onClick={() => removeBoton(i)} className="text-slate-300 hover:text-red-400"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            {tarjeta.botones.length < 2 && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input value={newBtnLabel} onChange={e => setNewBtnLabel(e.target.value)} placeholder="Texto del botón" className="text-xs flex-1" />
                  <select value={newBtnEstilo} onChange={e => setNewBtnEstilo(e.target.value)} className="text-xs border rounded-lg px-2 text-slate-600 bg-white">
                    <option value="primario">Primario</option>
                    <option value="secundario">Secundario</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Input value={newBtnUrl} onChange={e => setNewBtnUrl(e.target.value)} placeholder="URL destino (puede ser afiliado)" className="text-xs flex-1" />
                  <Button size="sm" variant="outline" onClick={addBoton} className="h-8"><Plus className="w-3 h-3" /></Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div>
          <Label className="text-xs text-slate-400 mb-2 block">Vista previa</Label>
          {hasContent ? (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-3 max-w-xs">
              {tarjeta.imagen_url && (
                <img src={tarjeta.imagen_url} alt="" className="w-full h-32 object-cover rounded-lg" onError={e => e.target.style.display = "none"} />
              )}
              {tarjeta.titulo && <p className="font-bold text-slate-800 text-sm">{tarjeta.titulo}</p>}
              {tarjeta.subtitulo && <p className="text-xs text-slate-500">{tarjeta.subtitulo}</p>}
              {tarjeta.items_check.length > 0 && (
                <ul className="space-y-1">
                  {tarjeta.items_check.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-700">
                      <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />{item}
                    </li>
                  ))}
                </ul>
              )}
              {tarjeta.botones.length > 0 && (
                <div className="flex gap-2 flex-wrap pt-1">
                  {tarjeta.botones.map((b, i) => (
                    <span key={i} className={`text-xs px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${b.estilo === "primario" ? "bg-indigo-600 text-white" : "border border-indigo-400 text-indigo-600"}`}>{b.label}</span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 rounded-xl h-32 flex items-center justify-center text-xs text-slate-400">
              Completá los campos para ver la previa
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TarjetasRecursos({ form, setForm }) {
  const tarjetas = form.tarjetas_recursos || [];

  const add = () => setForm(f => ({ ...f, tarjetas_recursos: [...(f.tarjetas_recursos || []), { ...emptyTarjeta }] }));
  const remove = (i) => setForm(f => ({ ...f, tarjetas_recursos: f.tarjetas_recursos.filter((_, idx) => idx !== i) }));
  const update = (i, val) => setForm(f => {
    const arr = [...f.tarjetas_recursos];
    arr[i] = val;
    return { ...f, tarjetas_recursos: arr };
  });

  return (
    <div className="space-y-3">
      {tarjetas.map((t, i) => (
        <TarjetaEditor key={i} index={i} tarjeta={t} onChange={v => update(i, v)} onRemove={() => remove(i)} />
      ))}
      <Button variant="outline" className="gap-2 w-full border-dashed text-slate-500 hover:text-indigo-600 hover:border-indigo-300" onClick={add}>
        <Plus className="w-4 h-4" /> Agregar tarjeta de recurso
      </Button>
    </div>
  );
}