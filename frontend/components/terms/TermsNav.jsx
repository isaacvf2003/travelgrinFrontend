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
    <nav className="hidden lg:block sticky top-8">
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground mb-4 px-4">
        Contenido
      </p>
      <ul className="space-y-1">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="block text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg px-4 py-2 transition-all duration-200"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}