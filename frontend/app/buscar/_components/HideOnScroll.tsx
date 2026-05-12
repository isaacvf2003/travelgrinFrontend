"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type HideOnScrollProps = {
  children: ReactNode;
  className?: string;
  visibleClassName?: string;
  hiddenClassName?: string;
  threshold?: number;
  mobileThreshold?: number;
  mobileThresholdVh?: number;
  mobileRevealOnScrollUp?: boolean;
};

export default function HideOnScroll({
  children,
  className = "",
  visibleClassName = "translate-y-0 opacity-100",
  hiddenClassName = "-translate-y-full opacity-0 pointer-events-none",
  threshold = 120,
  mobileThreshold,
  mobileThresholdVh,
  mobileRevealOnScrollUp = true,
}: HideOnScrollProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const getActiveThreshold = () => {
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      if (!isMobile) return threshold;
      if (typeof mobileThreshold === "number") return mobileThreshold;
      if (typeof mobileThresholdVh === "number") return Math.round(window.innerHeight * mobileThresholdVh);
      return threshold;
    };

    const onScroll = () => {
      const currentY = window.scrollY;
      const goingDown = currentY > lastScrollY;
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      const activeThreshold = getActiveThreshold();

      if (currentY <= activeThreshold) {
        setIsVisible(true);
      } else if (goingDown) {
        setIsVisible(false);
      } else {
        setIsVisible(!isMobile || mobileRevealOnScrollUp);
      }

      lastScrollY = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [threshold, mobileThreshold, mobileThresholdVh, mobileRevealOnScrollUp]);

  return (
    <div
      className={`${className} transition-all duration-300 ease-out ${isVisible ? visibleClassName : hiddenClassName}`}
    >
      {children}
    </div>
  );
}
