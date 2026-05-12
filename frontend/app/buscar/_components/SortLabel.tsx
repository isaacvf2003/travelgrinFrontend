"use client";

import { useTranslation } from "@/app/hooks/useTranslation";

export default function SortLabel() {
  const { t } = useTranslation();
  return <span>{t("ordenar_por")}</span>;
}
