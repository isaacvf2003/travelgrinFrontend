import React from 'react';
import { ShieldAlert } from 'lucide-react';

export default function ImportantBox({ children }) {
  return (
    <div className="my-7 rounded-3xl border border-[#b9dde2] bg-[#f3fbfb] p-5 shadow-[inset_5px_0_0_#075965,0_16px_38px_rgba(7,89,101,0.08)] md:p-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#075965] text-white shadow-[0_10px_24px_rgba(7,89,101,0.18)]">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#075965]">Importante</p>
      </div>
      <div className="text-sm leading-7 text-[#40535a]">
        {children}
      </div>
    </div>
  );
}
