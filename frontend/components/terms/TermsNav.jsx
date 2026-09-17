import React from 'react';

const sections = [
  { id: 'que-es', label: '¿Qué es Travelgrin?' },
  { id: 'definiciones', label: '1. Definiciones Clave' },
  { id: 'naturaleza', label: '2. Naturaleza del Servicio' },
  { id: 'registro', label: '3. Registro y Elegibilidad' },
  { id: 'oferentes', label: '4. Obligaciones Oferentes' },
  { id: 'viajeros', label: '5. Reglas Viajeros' },
  { id: 'privacidad', label: '6. Privacidad y Datos' },
  { id: 'propiedad', label: '7. Propiedad Intelectual' },
  { id: 'responsabilidad', label: '8. Limitación de Responsabilidad' },
  { id: 'modelo', label: '9. Modelo Comercial' },
  { id: 'modificaciones', label: '10. Modificaciones y Contacto' },
];

export default function TermsNav() {
  return (
    <nav className="sticky top-24 rounded-[1.75rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_45px_rgba(9,93,104,0.10)] backdrop-blur">
      <p className="mb-4 px-3 text-xs font-extrabold uppercase tracking-[0.24em] text-[#08aeba]">
        Contenido
      </p>
      <ul className="space-y-1.5">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-[#52676e] transition-all duration-200 hover:translate-x-1 hover:bg-[#e9fbfa] hover:text-[#075965]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#08d9bd]/45 transition-all group-hover:bg-[#08aeba] group-hover:shadow-[0_0_0_4px_rgba(8,217,189,0.14)]" />
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
