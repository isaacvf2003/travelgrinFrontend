import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, X, Palette } from "lucide-react";

const COLORES_FONDO = [
  { label: "Blanco", value: "#ffffff" },
  { label: "Gris claro", value: "#f8fafc" },
  { label: "Indigo suave", value: "#eef2ff" },
  { label: "Verde suave", value: "#f0fdf4" },
  { label: "Amarillo suave", value: "#fefce8" },
  { label: "Rosa suave", value: "#fdf2f8" },
  { label: "Indigo fuerte", value: "#4338ca" },
  { label: "Verde oscuro", value: "#166534" },
  { label: "Slate oscuro", value: "#1e293b" },
];

const COLORES_TEXTO = [
  { label: "Slate oscuro", value: "#1e293b" },
  { label: "Gris medio", value: "#64748b" },
  { label: "Indigo", value: "#4338ca" },
  { label: "Verde", value: "#16a34a" },
  { label: "Rojo", value: "#dc2626" },
  { label: "Blanco", value: "#ffffff" },
  { label: "Naranja", value: "#ea580c" },
  { label: "Violeta", value: "#7c3aed" },
];

const emptyBloque = {
  titulo: "",
  texto: "",
  color_fondo: "#f8fafc",
  color_texto: "#1e293b",
};

function ColorPicker({ label, value, onChange, opciones }) {
  return (
    <div>
      <Label className="text-xs text-slate-400 mb-1 block">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {opciones.map(c => (
          <button key={c.value} title={c.label} onClick={() => onChange(c.value)}
            className={`w-6 h-6 rounded-full border-2 transition-all ${value === c.value ? "border-indigo-500 scale-110" : "border-transparent hover:border-slate-300"}`}
            style={{ backgroundColor: c.value }} />
        ))}
        <div className="flex items-center gap-1 ml-1">
          <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-6 h-6 rounded cursor-pointer border border-slate-200" title="Color personalizado" />
          <span className="text-xs text-slate-400">{value}</span>
        </div>
      </div>
    </div>
  );
}

function BloqueEditor({ bloque, onChange, onRemove, index }) {
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bloque #{index + 1}</span>
          {bloque.titulo && <span className="text-xs text-slate-600">— {bloque.titulo}</span>}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={onRemove}><X className="w-3.5 h-3.5" /></Button>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-slate-400 mb-1 block">Título (opcional)</Label>
            <Input value={bloque.titulo} onChange={e => onChange({ ...bloque, titulo: e.target.value })} placeholder="Título del bloque" className="text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-400 mb-1 block">Texto</Label>
            <Textarea value={bloque.texto} onChange={e => onChange({ ...bloque, texto: e.target.value })} placeholder="Contenido del bloque de texto..." className="text-sm min-h-[80px]" />
          </div>
          <ColorPicker label="Color de fondo" value={bloque.color_fondo} onChange={v => onChange({ ...bloque, color_fondo: v })} opciones={COLORES_FONDO} />
          <ColorPicker label="Color de texto" value={bloque.color_texto} onChange={v => onChange({ ...bloque, color_texto: v })} opciones={COLORES_TEXTO} />
        </div>

        {/* Preview */}
        <div>
          <Label className="text-xs text-slate-400 mb-2 block">Vista previa</Label>
          <div className="rounded-xl p-5 min-h-[80px]" style={{ backgroundColor: bloque.color_fondo, color: bloque.color_texto }}>
            {bloque.titulo && <p className="font-bold text-base mb-2">{bloque.titulo}</p>}
            {bloque.texto ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{bloque.texto}</p>
            ) : (
              <p className="text-xs opacity-40 italic">El texto aparecerá aquí...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BloqueTextoColor({ form, setForm }) {
  const bloques = form.bloques_color || [];

  const add = () => setForm(f => ({ ...f, bloques_color: [...(f.bloques_color || []), { ...emptyBloque }] }));
  const remove = (i) => setForm(f => ({ ...f, bloques_color: f.bloques_color.filter((_, idx) => idx !== i) }));
  const update = (i, val) => setForm(f => {
    const arr = [...f.bloques_color];
    arr[i] = val;
    return { ...f, bloques_color: arr };
  });

  return (
    <div className="space-y-3">
      {bloques.map((b, i) => (
        <BloqueEditor key={i} index={i} bloque={b} onChange={v => update(i, v)} onRemove={() => remove(i)} />
      ))}
      <Button variant="outline" className="gap-2 w-full border-dashed text-slate-500 hover:text-indigo-600 hover:border-indigo-300" onClick={add}>
        <Plus className="w-4 h-4" /> Agregar bloque con color
      </Button>
    </div>
  );
}