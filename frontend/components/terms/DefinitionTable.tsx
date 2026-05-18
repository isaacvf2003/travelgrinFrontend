import React from 'react';

export default function DefinitionTable({ items }) {
  return (
    <div className="my-7 grid gap-3">
      {items.map((item, idx) => (
        <div key={idx} className="grid gap-3 rounded-2xl border border-[#d7f1f0] bg-[#fbffff] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#9ee8e6] hover:shadow-[0_14px_34px_rgba(8,174,186,0.10)] sm:grid-cols-[12rem_minmax(0,1fr)] sm:p-5">
          <span className="text-sm font-extrabold text-[#075965]">
            {item.term}
          </span>
          <span className="text-sm leading-7 text-[#40535a]">
            {item.definition}
          </span>
        </div>
      ))}
    </div>
  );
}
