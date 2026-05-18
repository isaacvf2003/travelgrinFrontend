import React from 'react';

export default function SectionHeading({ number, title, id }) {
  return (
    <div id={id} className="scroll-mt-8 mb-6 mt-14 first:mt-0">
      <div className="flex items-center gap-3">
        {number && (
          <span className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground font-heading font-bold text-sm">
            {number}
          </span>
        )}
        <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground tracking-tight uppercase">
          {title}
        </h2>
      </div>
      <div className="mt-3 h-px bg-gradient-to-r from-secondary/60 via-secondary/20 to-transparent" />
    </div>
  );
}