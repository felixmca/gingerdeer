import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { createLogger } from "@/lib/logger";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const log = createLogger("prospects/extract");

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}

/**
 * POST /api/admin/prospects/extract
 *
 * Two modes:
 *
 * EXTRACTION MODE (text provided):
 *   Parse raw text pasted from a website, Google Maps, LinkedIn, etc.
 *   Claude extracts explicit email contacts visible in that text.
 *   Email confidence reflects how clearly the address appeared in the source.
 *
 * RESEARCH MODE (no text, or text is a plain-English query):
 *   Claude uses its training knowledge to suggest real-world venues/organisations
 *   matching the category + sub_category + location description.
 *   Email addresses are inferred from common patterns (info@, events@, domain).
 *   email_confidence is capped at 0.45 — treat all as "needs verification".
 *   source_type = "ai_research"
 *
 * Body:
 *   text         — raw text to extract from (optional; omit or use plain-English
 *                  query like "tennis clubs in London" to trigger research mode)
 *   category     — required
 *   sub_category — optional hint
 *   source_url   — optional
 *   location     — optional location hint for research mode (default: London)
 */
export async function POST(request: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const rawText    = (body.text as string | undefined)?.trim() ?? "";
  const category   = (body.category as string | undefined)?.trim() ?? "";
  const sub_cat    = (body.sub_category as string | undefined)?.trim() ?? "";
  const source_url = (body.source_url as string | undefined)?.trim() ?? "";
  const location   = (body.location as string | undefined)?.trim() || "London";

  log.input("POST /api/admin/prospects/extract", {
    text_length: rawText.length,
    category: category || "(none)",
    sub_category: sub_cat || "(none)",
    source_url: source_url || null,
    location,
  });

  if (rawText.length > 20000) {
    return NextResponse.json({ error: "text too long (max 20,000 chars)" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI extraction not configured (ANTHROPIC_API_KEY missing)" }, { status: 503 });

  const client = new Anthropic({ apiKey });

  // ── Determine mode ────────────────────────────────────────────────────────
  // Research mode: no text given, OR text looks like a natural-language query
  // (short, no email addresses, no URLs, not structured data)
  const looksLikeQuery =
    rawText.length < 200 &&
    !rawText.includes("@") &&
    !rawText.includes("http") &&
    rawText.split("\n").length < 5;

  const isResearchMode = !rawText || looksLikeQuery;
  log.info(`mode determined: ${isResearchMode ? "research" : "extraction"}`, {
    looksLikeQuery,
    text_length: rawText.length,
    has_email: rawText.includes("@"),
    has_url: rawText.includes("http"),
  });

  // ── Prompts ───────────────────────────────────────────────────────────────
  const CONTACT_SCHEMA = `{
  "email": "string — required",
  "name": "string | null — person's full name if known",
  "role": "string | null — job title (e.g. 'Events Manager', 'Club Secretary', 'Office Manager')",
  "organisation": "string | null — venue / company name",
  "website": "string | null — official website domain",
  "phone": "string | null",
  "city": "string | null",
  "borough": "string | null — London borough if applicable",
  "category": "string | null",
  "sub_category": "string | null",
  "email_type": "'personal' | 'generic' | 'role_based'",
  "email_confidence": "number 0.0–1.0",
  "notes": "string | null"
}`;

  let systemPrompt: string;
  let userPrompt: string;

  if (isResearchMode) {
    systemPrompt = `You are a B2B prospecting assistant for Juice for Teams, a London ginger juice company targeting offices and leisure/events venues.

Your task: suggest real, named venues and organisations in the requested category and location that would be good prospects.
For each one, provide the most likely contact email address based on common patterns for that type of venue (e.g. info@, events@, membership@ — constructed from their known web domain).

Return ONLY a JSON array. No explanation, no markdown, just the raw array.

Each object:
${CONTACT_SCHEMA}

Rules:
- Only include real, named organisations you are confident exist
- Infer the most plausible email from the organisation's domain — use standard patterns (info@, hello@, events@, membership@, office@)
- Set email_confidence between 0.25 and 0.45 — these are inferred, not verified
- email_type: use 'generic' for info@/hello@, 'role_based' for events@/membership@/office@
- Aim for 10–20 contacts
- Do NOT invent venues that don't exist — only include organisations you know`;

    const queryDesc = rawText || `${sub_cat || category} venues in ${location}`;
    userPrompt = `Find prospects matching this description: "${queryDesc}"
Category: ${category}${sub_cat ? `\nSub-category: ${sub_cat}` : ""}
Location: ${location}

Return 10–20 real, named organisations with inferred contact emails.`;
  } else {
    systemPrompt = `You are a B2B contact data extraction assistant for Juice for Teams, a London ginger juice company.
Extract contact records from raw text (copied from websites, event listings, directories, Google Maps, etc.).

Return ONLY a JSON array. No explanation, no markdown, no text outside the array.

Each object:
${CONTACT_SCHEMA}

Rules:
- Only include records with a valid-looking email address visible in the text
- Set email_confidence: personal name-based emails ~0.9, generic info@/hello@ ~0.65, role-based events@/hr@ ~0.75
- Return [] if no valid email contacts are found in the text`;

    userPrompt = `Extract all email contacts from the following text.
${category   ? `Default category: ${category}` : ""}
${sub_cat    ? `Default sub-category: ${sub_cat}` : ""}
${source_url ? `Source URL: ${source_url}` : ""}

TEXT:
${rawText}`;
  }

  // ── Call Claude ───────────────────────────────────────────────────────────
  try {
    const model = "claude-haiku-4-5-20251001";
    log.info("calling Anthropic API", {
      model,
      max_tokens: 4096,
      mode: isResearchMode ? "research" : "extraction",
      prompt_length: userPrompt.length,
    });

    const message = await client.messages.create({
      model,
      max_tokens: 4096,
      system:     systemPrompt,
      messages:   [{ role: "user", content: userPrompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text?.trim() ?? "";
    log.info("Anthropic response received", {
      response_length: raw.length,
      stop_reason: message.stop_reason,
      input_tokens: message.usage?.input_tokens,
      output_tokens: message.usage?.output_tokens,
    });

    // ── Robust JSON extraction ─────────────────────────────────────────────
    // Strategy: find the first '[' and the last ']' and parse that substring.
    // This handles: markdown fences, trailing explanation text, leading commentary.
    let contacts: Record<string, unknown>[] = [];
    const jsonStart = raw.indexOf("[");
    const jsonEnd   = raw.lastIndexOf("]");

    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      const slice = raw.slice(jsonStart, jsonEnd + 1);
      try {
        const parsed = JSON.parse(slice);
        contacts = Array.isArray(parsed) ? parsed : [];
      } catch {
        console.error("[prospects/extract] JSON slice unparseable:", slice.slice(0, 200));
        return NextResponse.json(
          { error: "AI returned malformed JSON", raw: raw.slice(0, 500) },
          { status: 500 }
        );
      }
    }
    // If no '[' found → Claude returned nothing useful → return empty list (not an error)

    // ── Apply defaults and source metadata ────────────────────────────────
    const sourceType = isResearchMode ? "ai_research" : "ai_extract";
    log.transform("enriching contacts with source metadata", {
      parsed_count: contacts.length,
      source_type: sourceType,
      default_category: category || null,
    });

    const enriched = contacts.map((c) => ({
      ...c,
      category:     c.category     || category  || null,
      sub_category: c.sub_category || sub_cat   || null,
      source_url:   source_url || null,
      source_type:  sourceType,
      source_raw:   isResearchMode ? `research: ${userPrompt.slice(0, 500)}` : rawText.slice(0, 2000),
    }));

    const mode = isResearchMode ? "research" : "extract";
    log.done(`${mode} complete`, { contacts: enriched.length, needs_verification: isResearchMode });
    return NextResponse.json({
      contacts:      enriched,
      count:         enriched.length,
      mode,
      needs_verification: isResearchMode,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("Anthropic API call failed", { message: msg });
    return NextResponse.json({ error: "AI extraction failed: " + msg }, { status: 500 });
  }
}
