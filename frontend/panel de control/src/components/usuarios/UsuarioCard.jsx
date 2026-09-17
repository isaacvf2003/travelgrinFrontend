import { User, Mail, Globe, Calendar, Eye, MessageSquare, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const estadoColors = {
  Activo: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Nuevo: "bg-blue-100 text-blue-700 border-blue-200",
  Inactivo: "bg-slate-100 text-slate-600 border-slate-200",
  "En Revisión": "bg-amber-100 text-amber-700 border-amber-200",
  Suspendido: "bg-red-100 text-red-700 border-red-200",
  Verificado: "bg-violet-100 text-violet-700 border-violet-200",
};

export default function UsuarioCard({ usuario, onDetalle, onMensaje, onCambiarEstado }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm">{usuario.id || "1"}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${estadoColors[usuario.estado] || estadoColors.Activo}`}>
              {usuario.estado}
            </span>
            <span className="text-sm text-slate-700 font-medium">{usuario.nombre}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{usuario.email}</span>
            {usuario.pais_origen && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{usuario.pais_origen}</span>}
            {usuario.pais_destino && <span className="text-slate-300">→</span>}
            {usuario.pais_destino && <span>{usuario.pais_destino}</span>}
            {usuario.tipo && <span className="bg-slate-100 px-2 py-0.5 rounded-full">{usuario.tipo}</span>}
            {usuario.tipo_perfil && <span className="text-slate-400">{usuario.tipo_perfil}</span>}
          </div>
          {usuario.fecha_alta && (
            <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
              <Calendar className="w-3 h-3" />
              <span>{usuario.fecha_alta}</span>
              <span className="ml-2">Pub. Pagas: {usuario.pub_pagas || 0}</span>
              <span className="ml-2">Gratis: {usuario.pub_gratis || 0}</span>
            </div>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onDetalle && onDetalle(usuario)}>
            <Eye className="w-3 h-3 mr-1" />Detalle
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onMensaje && onMensaje(usuario)}>
            <MessageSquare className="w-3 h-3 mr-1" />Mensaje
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onCambiarEstado && onCambiarEstado(usuario)}>
            <Settings className="w-3 h-3 mr-1" />Estado
          </Button>
        </div>
      </div>
    </div>
  );
}