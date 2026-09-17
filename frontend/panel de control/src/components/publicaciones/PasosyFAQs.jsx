import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical } from "lucide-react";

// ─── PASOS ────────────────────────────────────────────────────────────────────

function PasoItem({ paso, index, onChange, onRemove, onMoveUp, onMoveDown }) {
  return (
    <div className="flex gap-3 items-start bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex flex-col items-center gap-1">
        <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{index + 1}</div>
        <button onClick={onMoveUp} className="text-slate-300 hover:text-slate-500"><ChevronUp className="w-3.5 h-3.5" /></button>
        <button onClick={onMoveDown} className="text-slate-300 hover:text-slate-500"><ChevronDown className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex-1 space-y-2">
        <Input value={paso.titulo} onChange={e => onChange({ ...paso, titulo: e.target.value })} placeholder={`Título del paso ${index + 1}`} className="text-sm font-medium" />
        <Textarea value={paso.descripcion} onChange={e => onChange({ ...paso, descripcion: e.target.value })} placeholder="Descripción del paso..." className="text-sm min-h-[60px]" />
        <Input value={paso.imagen_url || ""} onChange={e => onChange({ ...paso, imagen_url: e.target.value })} placeholder="Imagen URL (opcional)" className="text-xs" />
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 flex-shrink-0" onClick={onRemove}><Trash2 className="w-3.5 h-3.5" /></Button>
    </div>
  );
}

export function PasosEditor({ form, setForm }) {
  const pasos = form.pasos || [];

  const add = () => setForm(f => ({ ...f, pasos: [...(f.pasos || []), { titulo: "", descripcion: "", imagen_url: "" }] }));
  const remove = (i) => setForm(f => ({ ...f, pasos: f.pasos.filter((_, idx) => idx !== i) }));
  const update = (i, val) => setForm(f => { const arr = [...f.pasos]; arr[i] = val; return { ...f, pasos: arr }; });
  const moveUp = (i) => { if (i === 0) return; setForm(f => { const arr = [...f.pasos]; [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; return { ...f, pasos: arr }; }); };
  const moveDown = (i) => setForm(f => { if (i >= f.pasos.length - 1) return f; const arr = [...f.pasos]; [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; return { ...f, pasos: arr }; });

  return (
    <div className="space-y-3">
      {/* Preview */}
      {pasos.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Vista previa de pasos</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {pasos.map((p, i) => (
              <div key={i} className="flex-shrink-0 w-44 text-center">
                {p.imagen_url && <img src={p.imagen_url} alt="" className="w-full h-24 object-cover rounded-lg mb-2" onError={e => e.target.style.display = "none"} />}
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mx-auto mb-1">{i + 1}</div>
                <p className="text-xs font-semibold text-slate-700">{p.titulo || `Paso ${i + 1}`}</p>
                {p.descripcion && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{p.descripcion}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {pasos.map((p, i) => (
        <PasoItem key={i} paso={p} index={i} onChange={v => update(i, v)} onRemove={() => remove(i)} onMoveUp={() => moveUp(i)} onMoveDown={() => moveDown(i)} />
      ))}
      <Button variant="outline" className="gap-2 w-full border-dashed text-slate-500 hover:text-indigo-600 hover:border-indigo-300" onClick={add}>
        <Plus className="w-4 h-4" /> Agregar paso
      </Button>
    </div>
  );
}

// ─── FAQs ─────────────────────────────────────────────────────────────────────

function FaqItem({ faq, index, onChange, onRemove }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <span className="text-xs font-bold text-indigo-600 w-5">Q{index + 1}</span>
        <span className="flex-1 text-sm font-medium text-slate-700 truncate">{faq.pregunta || "(sin pregunta)"}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-300 hover:text-red-500 flex-shrink-0" onClick={e => { e.stopPropagation(); onRemove(); }}><Trash2 className="w-3 h-3" /></Button>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>
      {open && (
        <div className="p-3 space-y-2">
          <Input value={faq.pregunta} onChange={e => onChange({ ...faq, pregunta: e.target.value })} placeholder="Pregunta frecuente..." className="text-sm" />
          <Textarea value={faq.respuesta} onChange={e => onChange({ ...faq, respuesta: e.target.value })} placeholder="Respuesta..." className="text-sm min-h-[70px]" />
        </div>
      )}
    </div>
  );
}

export function FAQsEditor({ form, setForm }) {
  const faqs = form.faqs || [];

  const add = () => setForm(f => ({ ...f, faqs: [...(f.faqs || []), { pregunta: "", respuesta: "" }] }));
  const remove = (i) => setForm(f => ({ ...f, faqs: f.faqs.filter((_, idx) => idx !== i) }));
  const update = (i, val) => setForm(f => { const arr = [...f.faqs]; arr[i] = val; return { ...f, faqs: arr }; });

  return (
    <div className="space-y-2">
      {faqs.map((faq, i) => (
        <FaqItem key={i} faq={faq} index={i} onChange={v => update(i, v)} onRemove={() => remove(i)} />
      ))}
      <Button variant="outline" className="gap-2 w-full border-dashed text-slate-500 hover:text-indigo-600 hover:border-indigo-300" onClick={add}>
        <Plus className="w-4 h-4" /> Agregar pregunta frecuente
      </Button>
    </div>
  );
}