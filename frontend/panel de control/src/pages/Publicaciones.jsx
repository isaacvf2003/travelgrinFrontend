import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PublicacionCard from "../components/publicaciones/PublicacionCard";
import StatCard from "../components/dashboard/StatCard";
import StatsChart from "../components/dashboard/StatsChart";
import { Search, FileText, Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const ESTADOS = ["Activo", "Borrador", "Pausada", "Vencida", "En Revisión", "Suspendida", "Sin Revisión"];
const ESTADO_INFO = {
  Activo: "Normal, publicación visible al público",
  Borrador: "El usuario guardó pero no activó la publicación",
  Pausada: "No llega al cuota",
  Vencida: "Se cumplió el plazo y puede volver a pagar",
  "En Revisión": "Se dio al admin cuando alguien hizo una denuncia manejada",
  Suspendida: "Solo por el admin por algún fallo o descuido",
  "Sin Revisión": "Admin requiere revisión manual",
};

export default function Publicaciones() {
  const [pubs, setPubs] = useState([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("Publicaciones");
  const [cambiarEstadoPub, setCambiarEstadoPub] = useState(null);
  const [nuevoEstado, setNuevoEstado] = useState("");

  useEffect(() => {
    base44.entities.Publicacion.list().then(setPubs).catch(() => {});
  }, []);

  const filtered = pubs.filter(p =>
    p.titulo?.toLowerCase().includes(search.toLowerCase()) ||
    p.usuario_nombre?.toLowerCase().includes(search.toLowerCase()) ||
    p.categoria?.toLowerCase().includes(search.toLowerCase())
  );

  const pagas = pubs.filter(p => p.tipo === "Paga");
  const gratis = pubs.filter(p => p.tipo === "Gratis");

  const handleCambiarEstado = async () => {
    if (!cambiarEstadoPub || !nuevoEstado) return;
    await base44.entities.Publicacion.update(cambiarEstadoPub.id, { estado: nuevoEstado });
    setPubs(prev => prev.map(p => p.id === cambiarEstadoPub.id ? { ...p, estado: nuevoEstado } : p));
    setCambiarEstadoPub(null);
    setNuevoEstado("");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-1">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Total</p>
          <p className="text-3xl font-bold text-slate-800">{pubs.length || 278}</p>
          <p className="text-xs text-slate-400">-3 en el mes · +87 · -8</p>
        </div>
        <div className="bg-violet-50 rounded-2xl border border-violet-100 shadow-sm p-5 flex flex-col gap-1">
          <p className="text-xs text-violet-500 uppercase tracking-widest font-semibold">Pagas</p>
          <p className="text-3xl font-bold text-violet-700">{pagas.length || 250}</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm p-5 flex flex-col gap-1">
          <p className="text-xs text-emerald-500 uppercase tracking-widest font-semibold">Gratis</p>
          <p className="text-3xl font-bold text-emerald-700">{gratis.length || 28}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsChart title="Publicaciones: pagas vs gratis" label1="Pagas" label2="Gratis" color1="#10b981" color2="#a7f3d0" seed={3} />
        <StatsChart title="Denuncias por período" label1="Denuncias" color1="#f43f5e" color2="#fecdd3" seed={4} singleSerie />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-slate-100">
              <TabsTrigger value="Publicaciones">Publicaciones</TabsTrigger>
              <TabsTrigger value="Denuncias">Denuncias</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-9 text-sm" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 flex-shrink-0"
              onClick={() => window.location.href = `/NuevaPublicacion`}
            >
              <Plus className="w-4 h-4" /> Nueva
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No hay publicaciones aún</p>
            </div>
          ) : (
            filtered.map(p => (
              <PublicacionCard
                key={p.id}
                pub={p}
                onCambiarEstado={pub => { setCambiarEstadoPub(pub); setNuevoEstado(pub.estado); }}
              />
            ))
          )}
        </div>
      </div>

      <Dialog open={!!cambiarEstadoPub} onOpenChange={() => setCambiarEstadoPub(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Estado de Publicación</DialogTitle>
            <DialogDescription className="truncate">{cambiarEstadoPub?.titulo}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
              <SelectTrigger><SelectValue placeholder="Seleccionar estado" /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
            {nuevoEstado && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">{ESTADO_INFO[nuevoEstado]}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCambiarEstadoPub(null)}>Cancelar</Button>
              <Button onClick={handleCambiarEstado} className="bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}