import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UsuarioCard from "../components/usuarios/UsuarioCard";
import StatCard from "../components/dashboard/StatCard";
import MiniBarChart from "../components/dashboard/MiniBarChart";
import { Search, Plus, Users } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ESTADOS = ["Nuevo", "Activo", "Inactivo", "En Revisión", "Suspendido", "Verificado"];
const ESTADO_INFO = {
  Nuevo: "Hasta las 3 primeras publicaciones y después pasa a activo",
  Activo: "No realizó ninguna actividad (no se logó público) dentro de los 6 meses",
  Inactivo: "No realizó ninguna actividad pública en 6 meses",
  "En Revisión": "Por el admin, por documentación, denuncia, impago",
  Suspendido: "Por el admin, suspendida momentáneamente",
  Verificado: "Por el admin, para usuarios de confianza",
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("Oferente");
  const [selectedUser, setSelectedUser] = useState(null);
  const [cambiarEstadoUser, setCambiarEstadoUser] = useState(null);
  const [nuevoEstado, setNuevoEstado] = useState("");

  useEffect(() => {
    base44.entities.Usuario.list().then(setUsuarios).catch(() => {});
  }, []);

  const filtered = usuarios.filter(u =>
    u.tipo === tab &&
    (u.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.pais_origen?.toLowerCase().includes(search.toLowerCase()))
  );

  const activos = usuarios.filter(u => u.estado === "Activo" && u.tipo === tab).length;
  const total = usuarios.filter(u => u.tipo === tab).length;

  const handleCambiarEstado = async () => {
    if (!cambiarEstadoUser || !nuevoEstado) return;
    await base44.entities.Usuario.update(cambiarEstadoUser.id, { estado: nuevoEstado });
    setUsuarios(prev => prev.map(u => u.id === cambiarEstadoUser.id ? { ...u, estado: nuevoEstado } : u));
    setCambiarEstadoUser(null);
    setNuevoEstado("");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Total Oferentes" total={usuarios.filter(u => u.tipo === "Oferente").length || 122} activos={18} enMes={11} activosMes={18} color="blue" />
        <StatCard label="Total Demandantes" total={usuarios.filter(u => u.tipo === "Demandante").length || 1010} activos={375} enMes={22} activosMes={375} color="violet" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MiniBarChart title="Oferentes por mes: activos vs inactivos" seed={1} color1="#6366f1" color2="#e2e8f0" />
        <MiniBarChart title="Demandantes por mes: activos vs inactivos" seed={2} color1="#8b5cf6" color2="#e2e8f0" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-slate-100">
              <TabsTrigger value="Oferente">Oferentes</TabsTrigger>
              <TabsTrigger value="Demandante">Demandantes</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input className="pl-9 text-sm" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No hay usuarios registrados aún</p>
            </div>
          ) : (
            filtered.map(u => (
              <UsuarioCard
                key={u.id}
                usuario={u}
                onDetalle={setSelectedUser}
                onCambiarEstado={user => { setCambiarEstadoUser(user); setNuevoEstado(user.estado); }}
              />
            ))
          )}
        </div>
      </div>

      {/* Detalle Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle del Usuario</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-slate-400 text-xs">Nombre</p><p className="font-medium">{selectedUser.nombre}</p></div>
                <div><p className="text-slate-400 text-xs">Email</p><p className="font-medium">{selectedUser.email}</p></div>
                <div><p className="text-slate-400 text-xs">Estado</p><p className="font-medium">{selectedUser.estado}</p></div>
                <div><p className="text-slate-400 text-xs">Tipo</p><p className="font-medium">{selectedUser.tipo}</p></div>
                <div><p className="text-slate-400 text-xs">País Origen</p><p className="font-medium">{selectedUser.pais_origen || "-"}</p></div>
                <div><p className="text-slate-400 text-xs">País Destino</p><p className="font-medium">{selectedUser.pais_destino || "-"}</p></div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-xs space-y-1">
                <p className="font-semibold text-amber-700 mb-2">Estados posibles:</p>
                {Object.entries(ESTADO_INFO).map(([e, d]) => (
                  <p key={e}><span className="font-semibold">{e}:</span> {d}</p>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cambiar Estado Dialog */}
      <Dialog open={!!cambiarEstadoUser} onOpenChange={() => setCambiarEstadoUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Estado</DialogTitle>
            <DialogDescription>{cambiarEstadoUser?.nombre}</DialogDescription>
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
              <Button variant="outline" onClick={() => setCambiarEstadoUser(null)}>Cancelar</Button>
              <Button onClick={handleCambiarEstado} className="bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}