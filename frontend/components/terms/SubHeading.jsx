import React from 'react';

export default function SubHeading({ children }) {
  return (
    <h3 className="font-heading text-lg font-semibold text-secondary mt-8 mb-3">
      {children}
    </h3>
  );
}