import { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  Users,
  FileText,
  Tag,
  Settings,
  Menu,
  X,
  Globe2,
  MessageSquare,
  ChevronRight
} from "lucide-react";

const navItems = [
  { label: "Panel", icon: LayoutDashboard, page: "Panel" },
  { label: "Usuarios", icon: Users, page: "Usuarios" },
  { label: "Categorías", icon: Tag, page: "Categorias" },
  { label: "Publicaciones", icon: FileText, page: "Publicaciones" },
  { label: "Configuración", icon: Settings, page: "Configuracion" },
  { label: "Contacto / Sugerencias", icon: MessageSquare, page: "Contacto" },
];

const hiddenInNav = ["NuevaPublicacion"];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <style>{`
        :root {
          --sidebar-width: 220px;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .page-content { animation: fadeIn 0.25s ease; }
      `}</style>

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full bg-white border-r border-slate-100 shadow-sm z-40 transition-transform duration-300
        w-[220px]
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Globe2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">Ink Admin</p>
            <p className="text-xs text-slate-400">Gestión Inmigración</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="py-4 px-3 space-y-0.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group
                  ${isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 text-indigo-400" />}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-[220px] flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-100 px-5 py-3 flex items-center gap-3">
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 transition"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5 text-slate-600" /> : <Menu className="w-5 h-5 text-slate-600" />}
          </button>
          <div>
            <h1 className="text-base font-semibold text-slate-800">
              {navItems.find(n => n.page === currentPageName)?.label || currentPageName}
            </h1>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-5 lg:p-7 page-content">
          {children}
        </main>
      </div>
    </div>
  );
}