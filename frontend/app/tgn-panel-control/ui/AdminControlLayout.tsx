"use client";

import { type ComponentType, type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  FileText,
  LayoutDashboard,
  Menu,
  MessageSquareMore,
  Tag,
  Users,
  X,
} from "lucide-react";

export type AdminSection =
  | "panel"
  | "usuarios"
  | "categorias"
  | "publicaciones"
  | "feedback"
  | "como-funciona"
  | "configuracion"
  | "contacto";

type AdminControlLayoutProps = {
  children: ReactNode;
  activeSection: AdminSection;
};

const navItems: Array<{
  label: string;
  icon: ComponentType<{ className?: string }>;
  section: AdminSection;
}> = [
  { label: "Panel", icon: LayoutDashboard, section: "panel" },
  { label: "Usuarios", icon: Users, section: "usuarios" },
  { label: "Categor\u00edas", icon: Tag, section: "categorias" },
  { label: "Publicaciones", icon: FileText, section: "publicaciones" },
  { label: "C\u00f3mo funciona", icon: FileText, section: "como-funciona" },
  { label: "Feedback", icon: MessageSquareMore, section: "feedback" },
];

export default function AdminControlLayout({
  children,
  activeSection,
}: AdminControlLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentTitle = useMemo(() => {
    return navItems.find((item) => item.section === activeSection)?.label ?? "Panel";
  }, [activeSection]);

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-slate-50">
      <style>{`
        :root {
          --sidebar-width: 220px;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .admin-page-content { animation: fadeIn 0.25s ease; }
        .admin-page-content input:not([type="checkbox"]):not([type="radio"]):not([type="color"]),
        .admin-page-content select,
        .admin-page-content textarea {
          max-width: 100%;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .admin-page-content * {
          min-width: 0;
        }
      `}</style>

      <aside
        className={`
          fixed top-0 left-0 h-full bg-white border-r border-slate-100 shadow-sm z-40 transition-transform duration-300
          w-[220px]
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
          <img
            src="/og-image.jpg"
            alt="TravelGrin"
            className="h-8 w-8 object-contain"
          />

          <div>
            <p className="text-sm font-bold leading-tight text-slate-800">
              TravelGrinAdmin
            </p>
            <p className="text-xs text-slate-400">Panel de administraci\u00f3n</p>
          </div>
        </div>

        <nav className="space-y-0.5 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.section === activeSection;
            return (
              <Link
                key={item.section}
                href={
                  item.section === "panel"
                    ? "/tgn-panel-control"
                    : `/tgn-panel-control?section=${item.section}`
                }
                onClick={() => setSidebarOpen(false)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    isActive
                      ? "text-indigo-600"
                      : "text-slate-400 group-hover:text-slate-600"
                  }`}
                />
                <span className="flex-1 text-left">{item.label}</span>
                {isActive ? (
                  <ChevronRight className="h-3 w-3 text-indigo-400" />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-[220px]">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-100 bg-white/80 px-3 py-3 backdrop-blur sm:px-5">
          <button
            type="button"
            className="rounded-lg p-1.5 transition hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            {sidebarOpen ? (
              <X className="h-5 w-5 text-slate-600" />
            ) : (
              <Menu className="h-5 w-5 text-slate-600" />
            )}
          </button>
          <div>
            <h1 className="text-base font-semibold text-slate-800">
              {currentTitle}
            </h1>
          </div>
        </header>

        <main className="admin-page-content flex-1 min-w-0 overflow-x-hidden p-3 sm:p-4 lg:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
