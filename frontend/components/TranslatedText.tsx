"use client";

import { useTranslation } from "@/app/hooks/useTranslation";
import type { TranslationKey } from "@/app/lib/translations";

type Props = {
  id: TranslationKey;
};

export default function TranslatedText({ id }: Props) {
  const { t } = useTranslation();
  return <>{t(id)}</>;
}
