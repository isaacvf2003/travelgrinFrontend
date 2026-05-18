import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function CalloutBox({ title, children }) {
  return (
    <div className="my-6 rounded-xl border border-secondary/30 bg-secondary/5 p-5 md:p-6">
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-secondary flex-shrink-0" />
          <p className="font-heading font-bold text-foreground">{title}</p>
        </div>
      )}
      <div className="text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </div>
  );
}