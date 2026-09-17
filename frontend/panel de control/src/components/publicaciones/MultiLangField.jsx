import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const IDIOMAS = ["es", "en", "pt", "it"];

export default function MultiLangField({ label, fieldBase, form, setForm, multiline = false, placeholder = "" }) {
  const [activeTab, setActiveTab] = useState("es");

  return (
    <div>
      <Label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">{label}</Label>
      <div className="flex gap-1 mb-2">
        {IDIOMAS.map(l => (
          <button key={l} onClick={() => setActiveTab(l)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${activeTab === l ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {l}
          </button>
        ))}
      </div>
      {multiline ? (
        <Textarea
          value={form[`${fieldBase}_${activeTab}`] || ""}
          onChange={e => setForm(f => ({ ...f, [`${fieldBase}_${activeTab}`]: e.target.value }))}
          placeholder={placeholder || `Texto en ${activeTab}...`}
          className="text-sm min-h-[90px]"
        />
      ) : (
        <Input
          value={form[`${fieldBase}_${activeTab}`] || ""}
          onChange={e => setForm(f => ({ ...f, [`${fieldBase}_${activeTab}`]: e.target.value }))}
          placeholder={placeholder || `Texto en ${activeTab}...`}
          className="text-sm"
        />
      )}
    </div>
  );
}