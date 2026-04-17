import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { emailHash, emailDomainHash, computeQualityScore } from "@/lib/prospects";
import { createLogger } from "@/lib/logger";
import { NextResponse } from "next/server";

const log = createLogger("prospects/route");

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}

/**
 * GET /api/admin/prospects
 * List prospect contacts with filtering, search, and pagination.
 *
 * Query params:
 *   q              — search name, email, organisation
 *   category       — filter by category key
 *   lifecycle      — filter by lifecycle_stage
 *   status         — filter by status (default excludes nothing)
 *   sub_category   — filter by sub_category
 *   limit          — default 100, max 500
 *   offset         — default 0
 */
export async function GET(request: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q           = searchParams.get("q")?.trim() ?? "";
  const category    = searchParams.get("category") ?? "";
  const lifecycle   = searchParams.get("lifecycle") ?? "";
  const status      = searchParams.get("status") ?? "";
  const sub_cat     = searchParams.get("sub_category") ?? "";
  const limit       = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);
  const offset      = parseInt(searchParams.get("offset") ?? "0");

  log.input("GET /api/admin/prospects", {
    q: q || "(none)", category: category || "(all)", lifecycle: lifecycle || "(all)",
    status: status || "(all)", sub_category: sub_cat || "(all)", limit, offset,
  });

  const service = createServiceClient();
  let query = service
    .from("prospect_contacts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (category)  query = query.eq("category", category);
  if (lifecycle) query = query.eq("lifecycle_stage", lifecycle);
  if (status)    query = query.eq("status", status);
  if (sub_cat)   query = query.eq("sub_category", sub_cat);
  if (q) {
    query = query.or(
      `email.ilike.%${q}%,name.ilike.%${q}%,organisation.ilike.%${q}%,role.ilike.%${q}%`
    );
  }

  log.db("SELECT prospect_contacts", { filters: [category, lifecycle, status, sub_cat, q].filter(Boolean).join(", ") || "none", limit, offset });

  const { data, error, count } = await query;
  if (error) {
    log.error("SELECT prospect_contacts failed", { message: error.message, code: error.code });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  log.dbResult("prospect_contacts fetched", { rows: data?.length ?? 0, total: count ?? 0 });
  return NextResponse.json({ contacts: data ?? [], total: count ?? 0 });
}

/**
 * POST /api/admin/prospects
 * Create a single prospect contact.
 * Deduplicates by email_hash — returns { duplicate: true } if already exists.
 */
export async function POST(request: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const email    = (body.email as string | undefined)?.toLowerCase().trim();
  const category = (body.category as string | undefined)?.trim();

  if (!email)    return NextResponse.json({ error: "email is required" }, { status: 400 });
  if (!category) return NextResponse.json({ error: "category is required" }, { status: 400 });

  log.input("POST /api/admin/prospects", {
    email, category,
    name:         body.name    || null,
    organisation: body.organisation || null,
    role:         body.role    || null,
    source_type:  body.source_type || "manual",
  });

  const hash   = emailHash(email);
  const domain = emailDomainHash(email);

  log.transform("emailHash + emailDomainHash", { email_hash: hash, domain_hash: domain || null });

  const service = createServiceClient();

  // Deduplicate
  log.db("SELECT prospect_contacts — dedup check", { email_hash: hash });
  const { data: existing } = await service
    .from("prospect_contacts")
    .select("id, email, lifecycle_stage")
    .eq("email_hash", hash)
    .maybeSingle();

  if (existing) {
    log.warn("duplicate contact — skipping insert", { id: existing.id, email: existing.email, lifecycle: existing.lifecycle_stage });
    return NextResponse.json({ duplicate: true, existing }, { status: 200 });
  }
  log.dbResult("no duplicate found — proceeding");

  const quality = computeQualityScore({
    name:             body.name as string | null,
    role:             body.role as string | null,
    organisation:     body.organisation as string | null,
    website:          body.website as string | null,
    phone:            body.phone as string | null,
    source_url:       body.source_url as string | null,
    email_confidence: body.email_confidence as number | null,
  });

  log.transform("computeQualityScore", {
    name: !!(body.name), role: !!(body.role), organisation: !!(body.organisation),
    website: !!(body.website), phone: !!(body.phone), source_url: !!(body.source_url),
    email_confidence: body.email_confidence ?? null,
    quality_score: quality,
  });

  const row = {
    email,
    email_hash:          hash,
    domain_hash:         domain || null,
    category,
    sub_category:        (body.sub_category as string | null) ?? null,
    name:                (body.name as string | null) ?? null,
    role:                (body.role as string | null) ?? null,
    organisation:        (body.organisation as string | null) ?? null,
    website:             (body.website as string | null) ?? null,
    phone:               (body.phone as string | null) ?? null,
    city:                (body.city as string | null) ?? null,
    borough:             (body.borough as string | null) ?? null,
    country:             (body.country as string | null) ?? "GB",
    source_type:         (body.source_type as string | null) ?? "manual",
    source_url:          (body.source_url as string | null) ?? null,
    source_domain:       (body.source_domain as string | null) ?? null,
    acquisition_method:  (body.acquisition_method as string | null) ?? null,
    source_raw:          (body.source_raw as string | null) ?? null,
    email_type:          (body.email_type as string | null) ?? null,
    email_confidence:    (body.email_confidence as number | null) ?? null,
    tags:                Array.isArray(body.tags) ? body.tags : [],
    notes:               (body.notes as string | null) ?? null,
    quality_score:       quality,
    status:              "active" as const,
    lifecycle_stage:     "contact" as const,
    reviewed:            false,
  };

  log.db("INSERT prospect_contacts", { email, category, sub_category: row.sub_category, quality_score: quality, source_type: row.source_type });

  const { data, error } = await service
    .from("prospect_contacts")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    log.error("INSERT prospect_contacts failed", { message: error.message, code: error.code, email });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  log.dbResult("contact inserted", { id: data.id, email: data.email, quality_score: data.quality_score });
  log.done("prospect created", { id: data.id });
  return NextResponse.json({ contact: data }, { status: 201 });
}
