"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type ScrollAwareFiltersAsideProps = {
  children: ReactNode;
};

export default function ScrollAwareFiltersAside({ children }: ScrollAwareFiltersAsideProps) {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const onScroll = () => {
      const currentY = window.scrollY;
      const goingDown = currentY > lastScrollY;

      if (currentY <= 180) {
        setIsCompact(false);
      } else if (goingDown) {
        setIsCompact(true);
      } else {
        setIsCompact(false);
      }

      lastScrollY = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <aside
      className={`hidden md:sticky md:block md:h-fit transition-[top] duration-300 ease-out ${
        isCompact ? "md:top-[92px]" : "md:top-[190px]"
      }`}
    >
      {children}
    </aside>
  );
}
