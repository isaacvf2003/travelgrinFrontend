import React from 'react';
import { ShieldAlert } from 'lucide-react';

export default function ImportantBox({ children }) {
  return (
    <div className="my-6 rounded-xl border-l-4 border-l-primary bg-primary/5 border border-primary/10 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="w-5 h-5 text-primary flex-shrink-0" />
        <p className="font-heading font-bold text-primary text-sm uppercase tracking-wider">Importante</p>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </div>
  );
}