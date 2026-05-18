import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function CalloutBox({ title, children }) {
  return (
    <div className="my-7 overflow-hidden rounded-3xl border border-[#9ee8e6] bg-gradient-to-br from-[#ecfffd] to-white p-5 shadow-[0_16px_40px_rgba(8,174,186,0.10)] md:p-6">
      <div className="flex gap-4">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[#08d9bd]/15 text-[#0799aa]">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          {title && (
            <p className="mb-2 font-bold text-[#173238]">{title}</p>
          )}
          <div className="text-sm leading-7 text-[#40535a]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
