"use client";

import { useTranslation } from "@/app/hooks/useTranslation";
import SortLabel from "./SortLabel";
import SortSelect from "./SortSelect";

type SearchHeaderProps = {
  breadcrumbItems: string[];
  dedupedFilters: string[];
};

export default function SearchHeader({ breadcrumbItems, dedupedFilters }: SearchHeaderProps) {
  const { t } = useTranslation();
  const fullBreadcrumbs = [t("inicio"), ...breadcrumbItems].filter(Boolean);

  return (
    <div className="mb-4">
      <h1 className="text-2xl font-semibold text-[#0B2B30]">
        {t("buscar_titulo_pre")} <span className="text-[#00A9C6]">{t("buscar_titulo_highlight")}</span>{" "}
        {t("buscar_titulo_post")}
      </h1>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm text-[#6B7C80]">
        <div className="flex flex-wrap items-center gap-2">
          {fullBreadcrumbs.map((item, idx) => (
            <span key={`${item}-${idx}`} className="flex items-center">
              <span className={idx === fullBreadcrumbs.length - 1 ? "text-[#0B2B30]" : "text-[#00A9C6]"}>
                {item}
              </span>
              {idx < fullBreadcrumbs.length - 1 ? <span className="mx-2 text-[#6B7C80]">›</span> : null}
            </span>
          ))}
          {dedupedFilters.length ? (
            <span className="ml-3">
              {t("buscar_resultados_para")}{" "}
              <span className="font-semibold text-[#0B2B30]">{dedupedFilters.join(", ")}</span>
            </span>
          ) : null}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <SortLabel />
          <SortSelect />
        </div>
      </div>
    </div>
  );
}
