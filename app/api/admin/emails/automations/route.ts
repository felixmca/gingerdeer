import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}

/**
 * GET /api/admin/emails/automations
 * List all email automation rules, ordered by trigger_event then delay_hours.
 */
export async function GET() {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("email_automation_rules")
    .select("*")
    .order("trigger_event")
    .order("delay_hours");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

/**
 * POST /api/admin/emails/automations
 * Create a new automation rule.
 */
export async function POST(request: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { name, description, trigger_event, delay_hours, template_name, subject, body_html, enabled, conditions } = body;

  if (!name || !trigger_event || !template_name || !subject) {
    return NextResponse.json({ error: "name, trigger_event, template_name, subject are required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("email_automation_rules")
    .insert({
      name,
      description: description ?? "",
      trigger_event,
      delay_hours: Number(delay_hours ?? 0),
      template_name,
      subject,
      body_html: body_html ?? "",
      enabled: enabled !== false,
      conditions: conditions ?? {},
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data }, { status: 201 });
}
