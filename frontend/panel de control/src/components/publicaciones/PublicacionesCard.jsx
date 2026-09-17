import { User, Mail, Globe, Eye, MessageSquare, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

const estadoColors = {
  Activo: "bg-emerald-100 text-emerald-700",
  Borrador: "bg-slate-100 text-slate-600",
  Pausada: "bg-amber-100 text-amber-700",
  Vencida: "bg-orange-100 text-orange-700",
  "En Revisión": "bg-blue-100 text-blue-700",
  Suspendida: "bg-red-100 text-red-700",
  "Sin Revisión": "bg-gray-100 text-gray-600",
};

const ESTADOS_INFO = {
  "ERROR EN EL PAGO": "Suscripción con error en el pago",
  "BORRADOR": "El usuario guardó una publicación pero no la activó",
  "ACTIVA": "Normal",
  "PAUSADA": "No llega al cuota",
  "VENCIDA": "Se cumplió el plazo de la publicación y puede volver a pagar",
  "SIN REVISIÓN": "Se dio al admin cuando alguien hizo una denuncia manejada",
  "SUSPENDIDA": "Solo por el admin por algún fallo o descuido",
};

export default function PublicacionCard({ pub, onDetalle, onMensaje, onCambiarEstado }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm">#{pub.id || "1"}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColors[pub.estado] || "bg-slate-100 text-slate-600"}`}>
              {pub.estado}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pub.tipo === "Paga" ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"}`}>
              {pub.tipo}
            </span>
            <span className="text-sm text-slate-700 font-medium truncate max-w-[180px]">{pub.titulo}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
            {pub.usuario_nombre && <span className="flex items-center gap-1"><User className="w-3 h-3" />{pub.usuario_nombre}</span>}
            {pub.usuario_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{pub.usuario_email}</span>}
            {pub.pais_origen && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{pub.pais_origen}</span>}
            {pub.pais_destino && <span>→ {pub.pais_destino}</span>}
            {pub.categoria && <span className="bg-slate-100 px-2 py-0.5 rounded-full">{pub.categoria}</span>}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onDetalle && onDetalle(pub)}>
            <Eye className="w-3 h-3 mr-1" />Detalle
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onMensaje && onMensaje(pub)}>
            <MessageSquare className="w-3 h-3 mr-1" />Mensaje
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onCambiarEstado && onCambiarEstado(pub)}>
            <Settings className="w-3 h-3 mr-1" />Estado
          </Button>
        </div>
      </div>
    </div>
  );
}