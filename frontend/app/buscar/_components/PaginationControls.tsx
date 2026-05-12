"use client";

import { useEffect, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "@/app/hooks/useTranslation";

type SearchParams = Record<string, string | string[] | undefined>;

const PAGINATION_SCROLL_PREFIX = "travelgrin:buscar:pagination-scroll:";
const PAGINATION_PENDING_KEY = "travelgrin:buscar:pagination-pending-scroll";

type PendingScroll = {
  key: string;
  anchor?: string;
  mode: "anchor" | "restore";
};

function buildParamsWithPage(searchParams: SearchParams, page: number, pageParam: string, clearParams: string[] = []) {
  const params = new URLSearchParams();
  const keysToClear = new Set([pageParam, ...clearParams]);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (keysToClear.has(key)) return;
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((entry) => params.append(key, entry));
      return;
    }
    if (typeof value === "string" && value) params.set(key, value);
  });
  params.set(pageParam, String(page));
  return params;
}

function buildQueryWithPage(searchParams: SearchParams, page: number, pageParam: string, anchor?: string, clearParams: string[] = []) {
  const params = buildParamsWithPage(searchParams, page, pageParam, clearParams);
  return `?${params.toString()}${anchor ? `#${anchor}` : ""}`;
}

function buildClientUrl(searchParams: SearchParams, page: number, pageParam: string, clearParams: string[] = []) {
  const params = buildParamsWithPage(searchParams, page, pageParam, clearParams);
  return `?${params.toString()}`;
}

function canonicalParams(params: URLSearchParams) {
  return Array.from(params.entries())
    .sort(([keyA, valueA], [keyB, valueB]) => (keyA === keyB ? valueA.localeCompare(valueB) : keyA.localeCompare(keyB)))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function storageKey(pathname: string, searchParams: SearchParams, page: number, pageParam: string, anchor?: string, clearParams: string[] = []) {
  const params = buildParamsWithPage(searchParams, page, pageParam, clearParams);
  return `${PAGINATION_SCROLL_PREFIX}${pathname}|${anchor ?? pageParam}|${canonicalParams(params)}`;
}

function safeSessionStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readPendingScroll(): PendingScroll | null {
  const storage = safeSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(PAGINATION_PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingScroll;
  } catch {
    return null;
  }
}

function writePendingScroll(pending: PendingScroll) {
  const storage = safeSessionStorage();
  if (!storage) return;
  storage.setItem(PAGINATION_PENDING_KEY, JSON.stringify(pending));
}

function readStoredScrollY(key: string) {
  const storage = safeSessionStorage();
  if (!storage) return 0;
  try {
    const stored = storage.getItem(key);
    const parsed = stored ? (JSON.parse(stored) as { scrollY?: number }) : null;
    return Math.max(0, Number(parsed?.scrollY ?? 0));
  } catch {
    return 0;
  }
}

function markPageSeen(key: string) {
  const storage = safeSessionStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify({ seen: true, scrollY: window.scrollY }));
}

function visiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);

  if (currentPage <= 3) return [1, 2, 3, 4, totalPages];
  if (currentPage >= totalPages - 2) return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
}

export default function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  searchParams,
  pageParam = "page",
  anchor,
  label = "Paginación de resultados",
  clearParams = [],
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  searchParams: SearchParams;
  pageParam?: string;
  anchor?: string;
  label?: string;
  clearParams?: string[];
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const storage = safeSessionStorage();
    if (!storage) return;

    const currentKey = storageKey(pathname, searchParams, currentPage, pageParam, anchor, clearParams);
    const pending = readPendingScroll();

    if (!pending || pending.key !== currentKey) {
      markPageSeen(currentKey);
      return;
    }

    storage.removeItem(PAGINATION_PENDING_KEY);

    window.requestAnimationFrame(() => {
      if (pending.mode === "restore") {
        window.scrollTo({ top: readStoredScrollY(currentKey), behavior: "auto" });
        markPageSeen(currentKey);
        return;
      }

      const target = pending.anchor ? document.getElementById(pending.anchor) : null;
      target?.scrollIntoView({ block: "start", behavior: "auto" });
      window.requestAnimationFrame(() => markPageSeen(currentKey));
    });
  }, [anchor, clearParams, currentPage, pageParam, pathname, searchParams]);

  if (totalPages <= 1) return null;

  const pages = visiblePages(currentPage, totalPages);
  const pageStart = (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(totalItems, currentPage * pageSize);

  const handlePageClick = (event: MouseEvent<HTMLAnchorElement>, page: number) => {
    if (page === currentPage) {
      event.preventDefault();
      return;
    }

    event.preventDefault();

    const storage = safeSessionStorage();
    const currentKey = storageKey(pathname, searchParams, currentPage, pageParam, anchor, clearParams);
    const targetKey = storageKey(pathname, searchParams, page, pageParam, anchor, clearParams);
    const targetSeen = Boolean(storage?.getItem(targetKey));

    storage?.setItem(currentKey, JSON.stringify({ seen: true, scrollY: window.scrollY }));
    writePendingScroll({ key: targetKey, anchor, mode: targetSeen ? "restore" : "anchor" });

    router.push(buildClientUrl(searchParams, page, pageParam, clearParams), { scroll: false });
  };

  const renderPageLink = (page: number, children: ReactNode, className: string, ariaDisabled?: boolean, ariaCurrent?: "page") => (
    <Link
      href={buildQueryWithPage(searchParams, page, pageParam, anchor, clearParams)}
      onClick={(event) => {
        if (ariaDisabled) return;
        handlePageClick(event, page);
      }}
      aria-disabled={ariaDisabled}
      aria-current={ariaCurrent}
      className={className}
    >
      {children}
    </Link>
  );

  return (
    <nav className="mt-6 rounded-2xl border border-black/10 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)]" aria-label={label}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#6B7C80]">
          {t("pagination_showing")} <span className="font-semibold text-[#0B2B30]">{pageStart}</span>–<span className="font-semibold text-[#0B2B30]">{pageEnd}</span> {t("pagination_of")} {" "}
          <span className="font-semibold text-[#0B2B30]">{totalItems}</span>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {renderPageLink(
            Math.max(1, currentPage - 1),
            t("pagination_previous"),
            `rounded-lg border px-3 py-1.5 text-sm ${
              currentPage <= 1
                ? "pointer-events-none border-slate-200 text-slate-400"
                : "border-[#00A9C6] text-[#007D92] hover:bg-[#00A9C6]/10"
            }`,
            currentPage <= 1
          )}

          {pages.map((pageNumber, idx) => {
            const prev = pages[idx - 1];
            const showDots = typeof prev === "number" && pageNumber - prev > 1;
            return (
              <span key={`page-slot-${pageParam}-${pageNumber}`} className="inline-flex items-center gap-2">
                {showDots ? <span className="text-slate-400">…</span> : null}
                {renderPageLink(
                  pageNumber,
                  pageNumber,
                  `rounded-lg border px-3 py-1.5 text-sm ${
                    pageNumber === currentPage
                      ? "border-[#00A9C6] bg-[#00A9C6] text-white"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`,
                  undefined,
                  pageNumber === currentPage ? "page" : undefined
                )}
              </span>
            );
          })}

          {renderPageLink(
            Math.min(totalPages, currentPage + 1),
            t("pagination_next"),
            `rounded-lg border px-3 py-1.5 text-sm ${
              currentPage >= totalPages
                ? "pointer-events-none border-slate-200 text-slate-400"
                : "border-[#00A9C6] text-[#007D92] hover:bg-[#00A9C6]/10"
            }`,
            currentPage >= totalPages
          )}
        </div>
      </div>
    </nav>
  );
}
