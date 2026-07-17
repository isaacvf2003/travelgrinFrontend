"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAD39uvufIksf8SPQ";
const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "compact";
    },
  ) => string;
  remove?: (widgetId: string) => void;
  reset?: (widgetId: string) => void;
};

type TurnstileWindow = Window & {
  turnstile?: TurnstileApi;
};

type TurnstileWidgetProps = {
  onTokenChange: (token: string) => void;
  resetKey?: number | string;
  className?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact";
};

export default function TurnstileWidget({
  onTokenChange,
  resetKey = 0,
  className = "",
  theme = "light",
  size = "normal",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [compactViewport, setCompactViewport] = useState(false);
  const effectiveSize = size === "normal" && compactViewport ? "compact" : size;

  useEffect(() => {
    const updateSize = () => setCompactViewport(window.innerWidth < 360);
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const renderWidget = () => {
      const turnstile = (window as TurnstileWindow).turnstile;
      const container = containerRef.current;
      if (!turnstile || !container) return false;

      if (widgetIdRef.current && turnstile.remove) {
        turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      container.innerHTML = "";
      onTokenChange("");

      widgetIdRef.current = turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        theme,
        size: effectiveSize,
        callback: (token) => onTokenChange(token),
        "expired-callback": () => onTokenChange(""),
        "error-callback": () => onTokenChange(""),
      });

      return true;
    };

    if (!renderWidget()) {
      intervalId = window.setInterval(() => {
        if (cancelled || renderWidget()) {
          if (intervalId) window.clearInterval(intervalId);
        }
      }, 250);
    }

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      const turnstile = (window as TurnstileWindow).turnstile;
      if (widgetIdRef.current && turnstile?.remove) {
        turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [effectiveSize, onTokenChange, resetKey, scriptReady, theme]);

  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <Script
        id={TURNSTILE_SCRIPT_ID}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div className={`min-h-[65px] ${effectiveSize === "compact" ? "min-w-[150px]" : "min-w-[300px]"}`} ref={containerRef} />
    </div>
  );
}
