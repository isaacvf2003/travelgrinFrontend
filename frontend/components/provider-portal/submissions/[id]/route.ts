import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/app/lib/prisma";
import { getProviderPortalSession } from "@/app/api/_lib/providerPortal";
import { getTravelServiceHistorySourceById, upsertDashboardServiceHistory } from "@/app/api/_lib/dashboardHistory";
import { getLatestTravelServicePaymentByServiceId } from "@/app/api/_lib/travelServiceBilling";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TravelServiceSchema = {
  typeCol: "typeForm" | "taxonomyType";
  statusCol: "whatStop" | "status";
  searchingCol: "whatSearching";
  categoryIsJson: boolean;
  typeProfileIsJson: boolean;
};

function q(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

async function detectTravelServiceSchema(): Promise<TravelServiceSchema> {
  try {
    const cols = await prisma.$queryRaw<Array<{ column_name: string; udt_name: string }>>`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_name = 'travel_services'
    `;
    const names = new Set(cols.map((entry) => String(entry.column_name ?? "")));
    const byName = new Map(cols.map((entry) => [String(entry.column_name ?? ""), String(entry.udt_name ?? "").toLowerCase()]));
    return {
      typeCol: names.has("typeForm") ? "typeForm" : "taxonomyType",
      statusCol: names.has("whatStop") ? "whatStop" : "status",
      searchingCol: "whatSearching",
      categoryIsJson: (byName.get("category") ?? "") === "json" || (byName.get("category") ?? "") === "jsonb",
      typeProfileIsJson: (byName.get("typeProfile") ?? "") === "json" || (byName.get("typeProfile") ?? "") === "jsonb",
    };
  } catch {
    return { typeCol: "typeForm", statusCol: "whatStop", searchingCol: "whatSearching", categoryIsJson: false, typeProfileIsJson: false };
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value ?? "{}"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {}
  return {};
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeStatus(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "falta info") return "needs_info";
  if (normalized === "rechazado") return "rejected";
  if (normalized === "pending") return "pendiente";
  return normalized;
}

function normalizePlanType(value: unknown) {
  const raw = normalizeText(value).toLowerCase();
  if (raw === "featured" || raw === "featured_120d") return "featured";
  if (raw === "monthly" || raw === "featured_monthly") return "monthly";
  return "basic_free";
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((entry) => normalizeText(entry)).filter(Boolean);
  const single = normalizeText(value);
  return single ? [single] : [];
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = normalizeText(value).toLowerCase();
  if (["true", "1", "si", "sí", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return Boolean(value);
}

function isConfirmedPaymentStatus(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  return ["paid", "approved", "completed", "success"].includes(normalized);
}

function normalizeRefundStatus(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function isRefundBlockedStatus(value: unknown) {
  return ["refund_requested", "refund_reviewing", "refund_processing", "refunded"].includes(normalizeRefundStatus(value));
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getProviderPortalSession();
    if (!session?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const submissionId = normalizeText(id);
    if (!submissionId) {
      return NextResponse.json({ ok: false, error: "Missing submission id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const schema = await detectTravelServiceSchema();
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
        SELECT
          id,
          ${q("email")} as "email",
          ${q(schema.typeCol)} as "taxonomyType",
          category,
          ${q("typeProfile")} as "typeProfile",
          ${q(schema.statusCol)} as "status",
          ${q(schema.searchingCol)} as "whatSearching",
          ${q("country")} as "country",
          ${q("destinationCountry")} as "destinationCountry",
          ${q("isOfrezco")} as "isOfrezco",
          ${q("isIntermediario")} as "isIntermediario",
          contanos,
          website,
          ${q("createdAt")} as "createdAt",
          ${q("updatedAt")} as "updatedAt"
        FROM ${q("travel_services")}
        WHERE id = $1
        LIMIT 1
      `,
      submissionId,
    );

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ ok: false, error: "Submission not found" }, { status: 404 });
    }

    const sessionEmail = normalizeEmail(session.email);
    const rowEmail = normalizeEmail(row.email);
    if (!rowEmail || rowEmail !== sessionEmail) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const currentExtra = parseJsonObject(row.whatSearching);
    const latestPayment = await getLatestTravelServicePaymentByServiceId(submissionId).catch(() => null);
    const sourceServiceId = normalizeText(currentExtra.sourceServiceId);
    const sourcePayment =
      sourceServiceId && sourceServiceId !== submissionId
        ? await getLatestTravelServicePaymentByServiceId(sourceServiceId).catch(() => null)
        : null;
    const effectivePayment =
      [latestPayment, sourcePayment].find((payment) => payment && (payment.providerPaymentId || isConfirmedPaymentStatus(payment.status))) ??
      latestPayment ??
      sourcePayment;
    const nowIso = new Date().toISOString();
    const currentStatus = normalizeStatus(row.status);
    const action = normalizeText((body as Record<string, unknown>)?.action).toLowerCase();

    if (action === "request_refund") {
      if (currentStatus !== "rejected") {
        return NextResponse.json({ ok: false, error: "Refunds are only available for rejected submissions." }, { status: 409 });
      }

      const paymentStatus = normalizeText(effectivePayment?.status ?? currentExtra.paymentStatus).toLowerCase();
      if (!isConfirmedPaymentStatus(paymentStatus)) {
        return NextResponse.json({ ok: false, error: "Only confirmed payments can request a refund." }, { status: 409 });
      }

      if (isRefundBlockedStatus(currentExtra.refundStatus)) {
        return NextResponse.json({ ok: false, error: "This submission already has an active or completed refund." }, { status: 409 });
      }

      const providerPaymentId = normalizeText(effectivePayment?.providerPaymentId ?? currentExtra.providerPaymentId);
      if (!providerPaymentId) {
        return NextResponse.json({ ok: false, error: "Missing provider payment id for this submission." }, { status: 409 });
      }

      const nextExtra = {
        ...currentExtra,
        refundStatus: "refund_requested",
        refundRequestedAt: nowIso,
        refundReviewedAt: null,
        refundApprovedAt: null,
        refundRejectedAt: null,
        refundProcessingAt: null,
        refundedAt: null,
        refundFailedAt: null,
        refundReason: normalizeText(currentExtra.statusReason ?? currentExtra.refundReason) || null,
        refundAdminReason: null,
        refundAmount: effectivePayment?.amount ?? currentExtra.planAmount ?? null,
        refundCurrency: normalizeText(effectivePayment?.currency ?? currentExtra.planCurrency) || null,
        refundProviderReference: null,
        refundProviderResponse: null,
        refundProviderError: null,
        providerPaymentId,
        paymentStatus,
      };

      await prisma.$executeRawUnsafe(
        `
          UPDATE ${q("travel_services")}
          SET ${q(schema.searchingCol)} = $2,
              ${q("updatedAt")} = NOW()
          WHERE id = $1
        `,
        submissionId,
        JSON.stringify(nextExtra),
      );

      return NextResponse.json({
        ok: true,
        item: {
          id: submissionId,
          refundStatus: "refund_requested",
          refundRequestedAt: nowIso,
        },
      });
    }

    if (currentStatus === "rejected") {
      return NextResponse.json({ ok: false, error: "Rejected submissions cannot be edited from this flow." }, { status: 409 });
    }
    const publicationPlan = normalizePlanType(body.publicationPlan ?? currentExtra.publicationPlan ?? currentExtra.requestedPlan ?? currentExtra.planType);
    const requestedPlan = normalizeText(body.requestedPlan ?? currentExtra.requestedPlan) || (publicationPlan === "monthly" ? "featured_monthly" : publicationPlan === "featured" ? "featured_120d" : "basic_free");
    const category = toStringArray(body.category ?? currentExtra.category);
    const typeProfile = toStringArray(body.typeProfile ?? currentExtra.typeProfile);
    const venues = Array.isArray(body.venues) ? body.venues : Array.isArray(currentExtra.venues) ? currentExtra.venues : [];
    const images = Array.isArray(body.images) ? body.images : Array.isArray(currentExtra.images) ? currentExtra.images : [];
    const imageAssets = Array.isArray(body.imageAssets) ? body.imageAssets : Array.isArray(currentExtra.imageAssets) ? currentExtra.imageAssets : [];
    const receivingCountries = toStringArray(body.receivingCountries ?? currentExtra.receivingCountries);
    const socialLinks = Array.isArray(body.socialLinks) ? body.socialLinks : Array.isArray(currentExtra.socialLinks) ? currentExtra.socialLinks : [];
    const socialLinksDetailed = Array.isArray(body.socialLinksDetailed) ? body.socialLinksDetailed : Array.isArray(currentExtra.socialLinksDetailed) ? currentExtra.socialLinksDetailed : [];
    const priceByCurrency = Array.isArray(body.priceByCurrency) ? body.priceByCurrency : Array.isArray(currentExtra.priceByCurrency) ? currentExtra.priceByCurrency : [];

    const nextExtra = {
      ...currentExtra,
      name: body.name ?? currentExtra.name ?? "",
      phone: body.phone ?? currentExtra.phone ?? "",
      city: body.city ?? currentExtra.city ?? "",
      destinationMapUrl: body.destinationMapUrl ?? currentExtra.destinationMapUrl ?? "",
      whatSearching: body.whatSearching ?? currentExtra.whatSearching ?? "",
      whatStop: body.whatStop ?? currentExtra.whatStop ?? "",
      headquarterCountry: body.headquarterCountry ?? currentExtra.headquarterCountry ?? body.destinationCountry ?? row.destinationCountry ?? "",
      headquarterCity: body.headquarterCity ?? currentExtra.headquarterCity ?? body.city ?? currentExtra.city ?? "",
      headquarterMapUrl: body.headquarterMapUrl ?? currentExtra.headquarterMapUrl ?? body.destinationMapUrl ?? currentExtra.destinationMapUrl ?? "",
      activity: body.activity ?? currentExtra.activity ?? [],
      modality: body.modality ?? currentExtra.modality ?? [],
      languages: body.languages ?? currentExtra.languages ?? [],
      receivingCountriesMode: body.receivingCountriesMode ?? currentExtra.receivingCountriesMode ?? (receivingCountries.length ? "only" : "all"),
      receivingCountries,
      venues,
      images,
      imageAssets,
      providerLogo: body.providerLogo ?? currentExtra.providerLogo ?? "",
      providerLogoAsset: body.providerLogoAsset ?? currentExtra.providerLogoAsset ?? null,
      included: body.included ?? currentExtra.included ?? "",
      notIncluded: body.notIncluded ?? currentExtra.notIncluded ?? "",
      professionalLink: body.professionalLink ?? currentExtra.professionalLink ?? "",
      whatsappLink: body.whatsappLink ?? currentExtra.whatsappLink ?? "",
      travelerContactLink: body.travelerContactLink ?? currentExtra.travelerContactLink ?? "",
      socialLinks,
      socialLinksDetailed,
      price: body.price ?? currentExtra.price ?? "",
      currency: body.currency ?? currentExtra.currency ?? "",
      priceByCurrency,
      priceNegotiable: body.priceNegotiable === undefined ? toBoolean(currentExtra.priceNegotiable) : toBoolean(body.priceNegotiable),
      pricePeriod: body.pricePeriod ?? currentExtra.pricePeriod ?? "month",
      promoCode: body.promoCode ?? currentExtra.promoCode ?? "",
      category,
      typeProfile,
      publicationPlan,
      requestKind: normalizeText(body.requestKind ?? currentExtra.requestKind),
      previousPlan: normalizeText(body.previousPlan ?? currentExtra.previousPlan),
      requestedPlan,
      sourceServiceId: normalizeText(body.sourceServiceId ?? currentExtra.sourceServiceId),
      planAmount: body.planAmount ?? currentExtra.planAmount ?? 0,
      planCurrency: body.planCurrency ?? currentExtra.planCurrency ?? "USD",
      discountedPlanAmount: body.discountedPlanAmount ?? currentExtra.discountedPlanAmount ?? 0,
      acceptedTerms: body.acceptedTerms === undefined ? toBoolean(currentExtra.acceptedTerms) : body.acceptedTerms === true,
      submittedViaPortal: true,
      portalOwnerEmail: sessionEmail,
      locale: body.locale ?? currentExtra.locale ?? "es",
      paymentType: body.paymentType ?? currentExtra.paymentType ?? "",
      planType: body.planType ?? currentExtra.planType ?? requestedPlan,
      paymentStatus: normalizeText(effectivePayment?.status ?? currentExtra.paymentStatus),
      paymentReturnStatus: normalizeText(effectivePayment?.returnStatus ?? currentExtra.paymentReturnStatus),
      providerPaymentId: normalizeText(effectivePayment?.providerPaymentId ?? currentExtra.providerPaymentId),
      merchantCheckoutToken: normalizeText(effectivePayment?.merchantCheckoutToken ?? currentExtra.merchantCheckoutToken),
      statusReason: null,
      statusUpdatedAt: nowIso,
      resubmittedAt: nowIso,
      resubmittedFromNeedsInfo: currentStatus === "needs_info",
      resubmittedFromRejected: currentStatus === "rejected",
      resumeAction: "resume_submission",
    };

    const categoryValue = schema.categoryIsJson ? JSON.stringify(category[0] ?? "") : String(category[0] ?? "");
    const typeProfileValue = schema.typeProfileIsJson ? JSON.stringify(typeProfile[0] ?? "") : String(typeProfile[0] ?? "");
    const categorySqlValue = schema.categoryIsJson ? "CAST($2 AS jsonb)" : "$2";
    const typeProfileSqlValue = schema.typeProfileIsJson ? "CAST($3 AS jsonb)" : "$3";

    await prisma.$executeRawUnsafe(
      `
        UPDATE ${q("travel_services")}
        SET
          ${q(schema.typeCol)} = $1,
          category = ${categorySqlValue},
          ${q("typeProfile")} = ${typeProfileSqlValue},
          ${q("email")} = $4,
          ${q("isOfrezco")} = $5,
          ${q("isIntermediario")} = $6,
          ${q("country")} = $7,
          ${q("destinationCountry")} = $8,
          ${q(schema.searchingCol)} = $9,
          ${q(schema.statusCol)} = $10,
          contanos = $11,
          website = $12,
          ${q("updatedAt")} = NOW()
        WHERE id = $13
      `,
      "oferente",
      categoryValue,
      typeProfileValue,
      sessionEmail,
      toBoolean(body.isOfrezco ?? row.isOfrezco ?? currentExtra.isOfrezco),
      toBoolean(body.isIntermediario ?? row.isIntermediario ?? currentExtra.isIntermediario),
      normalizeText(body.country ?? row.country),
      normalizeText(body.destinationCountry ?? row.destinationCountry),
      JSON.stringify(nextExtra),
      "pendiente",
      normalizeText(body.contanos ?? ""),
      normalizeText(body.website ?? ""),
      submissionId,
    );

    const historySource = await getTravelServiceHistorySourceById(submissionId);
    if (historySource) {
      await upsertDashboardServiceHistory({
        ...historySource,
        lifecycleStatus: "pendiente",
        isDeleted: false,
        country: normalizeText(body.country ?? historySource.country ?? row.country),
        destinationCountry: normalizeText(body.destinationCountry ?? historySource.destinationCountry ?? row.destinationCountry),
        headquarterCountry: normalizeText(nextExtra.headquarterCountry ?? historySource.headquarterCountry),
        publicationPlan,
        categoryData: category,
        updatedAt: nowIso,
      });
    }

    return NextResponse.json({
      ok: true,
      item: {
        id: submissionId,
        status: "pendiente",
        paymentStatus: normalizeText(nextExtra.paymentStatus),
        resubmittedAt: nowIso,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getProviderPortalSession();
    if (!session?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const submissionId = normalizeText(id);
    if (!submissionId) {
      return NextResponse.json({ ok: false, error: "Missing submission id" }, { status: 400 });
    }

    const schema = await detectTravelServiceSchema();
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
        SELECT
          id,
          ${q("email")} as "email",
          ${q(schema.statusCol)} as "status",
          ${q(schema.searchingCol)} as "whatSearching",
          ${q("country")} as "country",
          ${q("destinationCountry")} as "destinationCountry",
          ${q("typeForm")} as "taxonomyType",
          ${q("createdAt")} as "createdAt",
          ${q("updatedAt")} as "updatedAt"
        FROM ${q("travel_services")}
        WHERE id = $1
        LIMIT 1
      `,
      submissionId,
    );

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ ok: false, error: "Submission not found" }, { status: 404 });
    }

    const rowEmail = normalizeText(row.email).toLowerCase();
    if (!rowEmail || rowEmail !== normalizeText(session.email).toLowerCase()) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const status = normalizeText(row.status).toLowerCase();
    const extra = parseJsonObject(row.whatSearching);
    const paymentStatus = normalizeText(extra.paymentStatus).toLowerCase();
    const lockedStatuses = new Set(["aprobado", "approved", "active", "activo", "paid"]);

    if (lockedStatuses.has(status) || paymentStatus === "paid") {
      return NextResponse.json(
        { ok: false, error: "Only pending or cancelled submissions can be deleted." },
        { status: 409 },
      );
    }

    const historySource = await getTravelServiceHistorySourceById(submissionId);
    if (historySource) {
      await upsertDashboardServiceHistory({
        sourceId: historySource.sourceId,
        taxonomyType: historySource.taxonomyType || normalizeText(row.taxonomyType),
        lifecycleStatus: "deleted",
        isDeleted: true,
        country: historySource.country || normalizeText(row.country),
        destinationCountry: historySource.destinationCountry || normalizeText(row.destinationCountry),
        headquarterCountry: historySource.headquarterCountry || normalizeText(extra.headquarterCountry ?? row.destinationCountry),
        publicationPlan: historySource.publicationPlan || normalizeText(extra.publicationPlan) || "basic_free",
        categoryData: historySource.categoryData ?? extra.category ?? null,
        createdAt: historySource.createdAt || (row.createdAt ? String(row.createdAt) : null),
        updatedAt: row.updatedAt ? String(row.updatedAt) : null,
        deletedAt: new Date().toISOString(),
      });
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM ${q("travel_services")} WHERE id = $1`,
      submissionId,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
