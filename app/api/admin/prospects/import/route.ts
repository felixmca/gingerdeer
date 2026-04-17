import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { emailHash, emailDomainHash, computeQualityScore } from "@/lib/prospects";
import { createLogger } from "@/lib/logger";
import { NextResponse } from "next/server";

const log = createLogger("prospects/import");

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}

interface ImportRow {
  email: string;
  name?: string;
  role?: string;
  organisation?: string;
  website?: string;
  phone?: string;
  city?: string;
  borough?: string;
  category: string;
  sub_category?: string;
  tags?: string;          // comma-separated
  source_url?: string;
  source_type?: string;
  acquisition_method?: string;
  notes?: string;
}

/**
 * POST /api/admin/prospects/import
 *
 * Bulk-import prospect contacts from a JSON array (parsed from CSV on the client).
 * Deduplicates by email_hash — skips existing contacts without error.
 *
 * Body: { rows: ImportRow[], category?: string }
 *   - `category` is a fallback applied to any row that lacks its own category field.
 *
 * Response: { imported, skipped_duplicates, errors, results }
 */
export async function POST(request: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { rows?: unknown[]; category?: string; source_type?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "rows array is required" }, { status: 400 });
  }
  if (rows.length > 2000) {
    return NextResponse.json({ error: "Maximum 2000 rows per import" }, { status: 400 });
  }

  const defaultCategory   = (body.category ?? "").trim();
  const defaultSourceType = (body.source_type ?? "csv_import").trim();

  log.input("POST /api/admin/prospects/import", {
    row_count: rows.length,
    default_category: defaultCategory || "(none)",
    default_source_type: defaultSourceType,
  });

  const service = createServiceClient();

  // ── 1. Collect all hashes and bulk-check for duplicates ──────────────────
  const parsed: { row: ImportRow; hash: string; domain: string }[] = [];
  const parseErrors: { index: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as Record<string, unknown>;
    const email = (r.email as string | undefined)?.toLowerCase().trim();
    if (!email || !email.includes("@")) {
      parseErrors.push({ index: i, reason: "missing or invalid email" });
      continue;
    }
    const category = ((r.category as string | undefined)?.trim() || defaultCategory);
    if (!category) {
      parseErrors.push({ index: i, reason: "category is required" });
      continue;
    }
    const importRow: ImportRow = {
      email,
      category,
      name:               (r.name as string | undefined)?.trim() || undefined,
      role:               (r.role as string | undefined)?.trim() || undefined,
      organisation:       (r.organisation as string | undefined)?.trim() || undefined,
      website:            (r.website as string | undefined)?.trim() || undefined,
      phone:              (r.phone as string | undefined)?.trim() || undefined,
      city:               (r.city as string | undefined)?.trim() || undefined,
      borough:            (r.borough as string | undefined)?.trim() || undefined,
      sub_category:       (r.sub_category as string | undefined)?.trim() || undefined,
      tags:               (r.tags as string | undefined)?.trim() || undefined,
      source_url:         (r.source_url as string | undefined)?.trim() || undefined,
      source_type:        (r.source_type as string | undefined)?.trim() || defaultSourceType,
      acquisition_method: (r.acquisition_method as string | undefined)?.trim() || undefined,
      notes:              (r.notes as string | undefined)?.trim() || undefined,
    };
    parsed.push({ row: importRow, hash: emailHash(email), domain: emailDomainHash(email) });
  }

  log.transform("rows parsed", { valid: parsed.length, parse_errors: parseErrors.length });

  if (parsed.length === 0) {
    log.warn("no valid rows after parsing", { parse_errors: parseErrors.length });
    return NextResponse.json({
      imported: 0,
      skipped_duplicates: 0,
      errors: parseErrors,
      results: [],
    });
  }

  // ── 2. Fetch existing hashes in one query ────────────────────────────────
  const allHashes = parsed.map((p) => p.hash);
  log.db("SELECT prospect_contacts — dedup check", { hash_count: allHashes.length });
  const { data: existingRows } = await service
    .from("prospect_contacts")
    .select("email_hash")
    .in("email_hash", allHashes);

  const existingHashes = new Set((existingRows ?? []).map((e) => e.email_hash as string));
  log.dbResult("existing hashes fetched", { existing_count: existingHashes.size });

  // ── 3. Build insert batch ────────────────────────────────────────────────
  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const { row, hash, domain } of parsed) {
    if (existingHashes.has(hash)) {
      skipped++;
      continue;
    }
    const quality = computeQualityScore({
      name:         row.name,
      role:         row.role,
      organisation: row.organisation,
      website:      row.website,
      phone:        row.phone,
      source_url:   row.source_url,
    });
    toInsert.push({
      email:              row.email,
      email_hash:         hash,
      domain_hash:        domain || null,
      category:           row.category,
      sub_category:       row.sub_category ?? null,
      name:               row.name ?? null,
      role:               row.role ?? null,
      organisation:       row.organisation ?? null,
      website:            row.website ?? null,
      phone:              row.phone ?? null,
      city:               row.city ?? null,
      borough:            row.borough ?? null,
      source_type:        row.source_type ?? defaultSourceType,
      source_url:         row.source_url ?? null,
      acquisition_method: row.acquisition_method ?? null,
      tags:               row.tags ? row.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      notes:              row.notes ?? null,
      quality_score:      quality,
      status:             "active",
      lifecycle_stage:    "contact",
      reviewed:           false,
    });
    // mark as seen so in-batch duplicates don't double-insert
    existingHashes.add(hash);
  }

  log.transform("dedup filter applied", { to_insert: toInsert.length, skipped_duplicates: skipped });

  if (toInsert.length === 0) {
    log.warn("all rows are duplicates — nothing to insert", { skipped });
    return NextResponse.json({
      imported: 0,
      skipped_duplicates: skipped,
      errors: parseErrors,
      results: [],
    });
  }

  // ── 4. Batch insert in chunks of 100 ────────────────────────────────────
  const CHUNK = 100;
  const results: { id: string; email: string }[] = [];
  const insertErrors: { email: string; reason: string }[] = [];
  const totalChunks = Math.ceil(toInsert.length / CHUNK);

  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk     = toInsert.slice(i, i + CHUNK);
    const chunkNum  = Math.floor(i / CHUNK) + 1;
    log.db(`INSERT prospect_contacts — chunk ${chunkNum}/${totalChunks}`, { chunk_size: chunk.length });

    const { data, error } = await service
      .from("prospect_contacts")
      .insert(chunk)
      .select("id, email");

    if (error) {
      log.error(`INSERT chunk ${chunkNum} failed`, { message: error.message, code: error.code, chunk_size: chunk.length });
      for (const r of chunk) {
        insertErrors.push({ email: r.email as string, reason: error.message });
      }
    } else {
      log.dbResult(`chunk ${chunkNum} inserted`, { rows: data?.length ?? 0 });
      results.push(...(data ?? []).map((d) => ({ id: d.id, email: d.email })));
    }
  }

  log.done("import complete", { imported: results.length, skipped_duplicates: skipped, errors: insertErrors.length + parseErrors.length });

  return NextResponse.json({
    imported:           results.length,
    skipped_duplicates: skipped,
    errors:             [...parseErrors, ...insertErrors],
    results,
  });
}
