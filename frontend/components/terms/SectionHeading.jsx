import React from 'react';

export default function SectionHeading({ number, title, id }) {
  return (
    <div id={id} className="scroll-mt-28 mb-6 mt-16 first:mt-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {number && (
          <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[#075965] text-sm font-extrabold text-white shadow-[0_12px_26px_rgba(7,89,101,0.18)]">
            {number}
          </span>
        )}
        <h2 className="text-2xl font-black uppercase tracking-tight text-[#173238] md:text-3xl">
          {title}
        </h2>
      </div>
      <div className="mt-4 h-1 w-full rounded-full bg-gradient-to-r from-[#08d9bd] via-[#08aeba]/40 to-transparent" />
    </div>
  );
}
