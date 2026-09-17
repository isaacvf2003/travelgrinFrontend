import { Label } from "@/components/ui/label";

export default function EtiquetasBlock({ label, opciones, field, form, setForm }) {
  const selected = form[field] || [];
  const toggle = (val) => {
    const next = selected.includes(val)
      ? selected.filter(s => s !== val)
      : [...selected, val];
    setForm(f => ({ ...f, [field]: next }));
  };

  return (
    <div>
      <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {opciones.map(op => (
          <button key={op} onClick={() => toggle(op)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              selected.includes(op)
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
            }`}>
            {op}
          </button>
        ))}
      </div>
    </div>
  );
}