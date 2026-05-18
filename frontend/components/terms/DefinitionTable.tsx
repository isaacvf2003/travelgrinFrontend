import React from 'react';

export default function DefinitionTable({ items }) {
  return (
    <div className="my-6 space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-4 p-4 rounded-lg bg-muted/50 border border-border/60">
          <span className="font-heading font-semibold text-primary text-sm whitespace-nowrap min-w-[140px]">
            {item.term}
          </span>
          <span className="text-sm text-muted-foreground leading-relaxed">
            {item.definition}
          </span>
        </div>
      ))}
    </div>
  );
}