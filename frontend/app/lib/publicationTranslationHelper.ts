"use client";

export type I18nLanguage = "es" | "en" | "pt" | "it";

export interface TranslatableExtraDescription {
  title: string;
  titleI18n?: Record<string, string> | null;
  body: string;
  bodyI18n?: Record<string, string> | null;
  visibleInCard?: boolean;
  lang?: string;
  prompt?: string;
  [key: string]: any;
}

export interface TranslatableSocialLink {
  kind: string;
  label: string;
  labelI18n?: Record<string, string> | null;
  url: string;
  [key: string]: any;
}

export interface TranslatablePublicationFields {
  title: string;
  titleI18n?: Record<string, string> | null;
  description: string;
  descriptionI18n?: Record<string, string> | null;
  publisherName?: string | null;
  providerInfoI18n?: Record<string, string> | null;
  extraDescriptions?: TranslatableExtraDescription[] | null;
  socialLinksDetailed?: TranslatableSocialLink[] | null;
  [key: string]: any;
}

const TARGET_LANGS: I18nLanguage[] = ["en", "pt", "it"];

/**
 * Checks if any required multilingual translations (EN, PT, IT) are missing
 * from the publication fields given that Spanish content is present.
 */
export function isPublicationMissingTranslations(fields: TranslatablePublicationFields): boolean {
  if (!fields) return false;

  // 1. Title
  const esTitle = (fields.titleI18n?.es || fields.title || "").trim();
  if (esTitle) {
    for (const lang of TARGET_LANGS) {
      if (!fields.titleI18n?.[lang]?.trim()) return true;
    }
  }

  // 2. Description
  const esDesc = (fields.descriptionI18n?.es || fields.description || "").trim();
  if (esDesc) {
    for (const lang of TARGET_LANGS) {
      if (!fields.descriptionI18n?.[lang]?.trim()) return true;
    }
  }

  // 3. Provider info
  const esProv = (fields.providerInfoI18n?.es || "").trim();
  if (esProv) {
    for (const lang of TARGET_LANGS) {
      if (!fields.providerInfoI18n?.[lang]?.trim()) return true;
    }
  }

  // 4. Extra description blocks
  if (Array.isArray(fields.extraDescriptions)) {
    for (const block of fields.extraDescriptions) {
      const bTitle = (block.titleI18n?.es || block.title || "").trim();
      if (bTitle) {
        for (const lang of TARGET_LANGS) {
          if (!block.titleI18n?.[lang]?.trim()) return true;
        }
      }
      const bBody = (block.bodyI18n?.es || block.body || "").trim();
      if (bBody) {
        for (const lang of TARGET_LANGS) {
          if (!block.bodyI18n?.[lang]?.trim()) return true;
        }
      }
    }
  }

  // 5. Social links
  if (Array.isArray(fields.socialLinksDetailed)) {
    for (const link of fields.socialLinksDetailed) {
      const label = (link.labelI18n?.es || link.label || "").trim();
      if (label) {
        for (const lang of TARGET_LANGS) {
          if (!link.labelI18n?.[lang]?.trim()) return true;
        }
      }
    }
  }

  return false;
}

async function requestTranslation(
  text: string,
  targetLangs: string[],
  isHtml: boolean,
  apiKey?: string
): Promise<Record<string, string>> {
  if (!text || !targetLangs.length) return {};
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const res = await fetch("/api/admin/translate-i18n", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        targetLangs,
        sourceLang: "es",
        isHtml,
        apiKey,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data?.translations && typeof data.translations === "object") {
        return data.translations;
      }
    }
  } catch (err) {
    console.warn("[PublicationTranslation] Translation request error:", err);
  }
  return {};
}

/**
 * Ensures that all missing multilingual translations (EN, PT, IT) are generated
 * via the translation endpoint in parallel, returning a clean updated copy.
 */
export async function ensurePublicationTranslations<T extends TranslatablePublicationFields>(
  fields: T,
  options?: {
    apiKey?: string;
    force?: boolean;
    onProgress?: (message: string) => void;
  }
): Promise<T> {
  if (!fields) return fields;

  const apiKey =
    options?.apiKey ||
    (typeof window !== "undefined" ? window.localStorage.getItem("tgn_ai_custom_api_key") : null) ||
    undefined;

  const titleEs = (fields.titleI18n?.es || fields.title || "").trim();
  const descEs = (fields.descriptionI18n?.es || fields.description || "").trim();
  const provEs = (fields.providerInfoI18n?.es || "").trim();

  // Clone targets
  const nextTitleI18n: Record<string, string> = {
    es: titleEs,
    ...(fields.titleI18n || {}),
  };
  const nextDescI18n: Record<string, string> = {
    es: descEs,
    ...(fields.descriptionI18n || {}),
  };
  const nextProvI18n: Record<string, string> = {
    ...(fields.providerInfoI18n || {}),
  };
  if (provEs) nextProvI18n.es = provEs;

  const nextExtraDesc: TranslatableExtraDescription[] = Array.isArray(fields.extraDescriptions)
    ? fields.extraDescriptions.map((b) => ({
        ...b,
        titleI18n: {
          ...(b.titleI18n || {}),
          es: (b.titleI18n?.es || b.title || "").trim(),
        },
        bodyI18n: {
          ...(b.bodyI18n || {}),
          es: (b.bodyI18n?.es || b.body || "").trim(),
        },
      }))
    : [];

  const nextSocialLinks: TranslatableSocialLink[] = Array.isArray(fields.socialLinksDetailed)
    ? fields.socialLinksDetailed.map((s) => ({
        ...s,
        labelI18n: {
          ...(s.labelI18n || {}),
          es: (s.labelI18n?.es || s.label || "").trim(),
        },
      }))
    : [];

  const promises: Promise<void>[] = [];

  // 1. Title
  if (titleEs) {
    const missingTitle = TARGET_LANGS.filter((l) => options?.force || !nextTitleI18n[l]?.trim());
    if (missingTitle.length > 0) {
      promises.push(
        requestTranslation(titleEs, missingTitle, false, apiKey).then((trans) => {
          Object.assign(nextTitleI18n, trans);
        })
      );
    }
  }

  // 2. Description
  if (descEs) {
    const missingDesc = TARGET_LANGS.filter((l) => options?.force || !nextDescI18n[l]?.trim());
    if (missingDesc.length > 0) {
      promises.push(
        requestTranslation(descEs, missingDesc, true, apiKey).then((trans) => {
          Object.assign(nextDescI18n, trans);
        })
      );
    }
  }

  // 3. Provider Info
  if (provEs) {
    const missingProv = TARGET_LANGS.filter((l) => options?.force || !nextProvI18n[l]?.trim());
    if (missingProv.length > 0) {
      promises.push(
        requestTranslation(provEs, missingProv, true, apiKey).then((trans) => {
          Object.assign(nextProvI18n, trans);
        })
      );
    }
  }

  // 4. Extra Description Blocks
  nextExtraDesc.forEach((block) => {
    const bTitle = (block.titleI18n?.es || block.title || "").trim();
    if (bTitle) {
      const missingBTitle = TARGET_LANGS.filter((l) => options?.force || !block.titleI18n?.[l]?.trim());
      if (missingBTitle.length > 0) {
        promises.push(
          requestTranslation(bTitle, missingBTitle, false, apiKey).then((trans) => {
            if (!block.titleI18n) block.titleI18n = {};
            Object.assign(block.titleI18n, trans);
          })
        );
      }
    }

    const bBody = (block.bodyI18n?.es || block.body || "").trim();
    if (bBody) {
      const missingBBody = TARGET_LANGS.filter((l) => options?.force || !block.bodyI18n?.[l]?.trim());
      if (missingBBody.length > 0) {
        promises.push(
          requestTranslation(bBody, missingBBody, true, apiKey).then((trans) => {
            if (!block.bodyI18n) block.bodyI18n = {};
            Object.assign(block.bodyI18n, trans);
          })
        );
      }
    }
  });

  // 5. Social Links
  nextSocialLinks.forEach((link) => {
    const label = (link.labelI18n?.es || link.label || "").trim();
    if (label) {
      const missingLabel = TARGET_LANGS.filter((l) => options?.force || !link.labelI18n?.[l]?.trim());
      if (missingLabel.length > 0) {
        promises.push(
          requestTranslation(label, missingLabel, false, apiKey).then((trans) => {
            if (!link.labelI18n) link.labelI18n = {};
            Object.assign(link.labelI18n, trans);
          })
        );
      }
    }
  });

  if (promises.length > 0) {
    if (options?.onProgress) {
      options.onProgress("🌐 Traduciendo campos a EN, PT, IT...");
    }
    await Promise.allSettled(promises);
  }

  return {
    ...fields,
    titleI18n: nextTitleI18n,
    descriptionI18n: nextDescI18n,
    providerInfoI18n: Object.keys(nextProvI18n).length > 0 ? nextProvI18n : fields.providerInfoI18n,
    extraDescriptions: nextExtraDesc,
    socialLinksDetailed: nextSocialLinks,
  };
}
