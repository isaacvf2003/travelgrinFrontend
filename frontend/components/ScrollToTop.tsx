"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // Reset scroll position to top instantly when page route changes
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
