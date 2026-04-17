#!/usr/bin/env node
/**
 * Juice for Teams — Postman Collection Generator & Sync
 *
 * Generates a complete Postman Collection v2.1 covering:
 *   1.  Supabase Direct REST API   — data-audit queries using service-role key
 *   2.  App API — Public           — /api/lead (no auth)
 *   3.  App API — Authenticated    — subscriptions, addresses, checkout, orders
 *   4.  App API — Admin            — CRM, emails, reports, billing, query
 *   5.  Internal                   — cron, webhooks
 *
 * ──────────────────────────────────────────────────────────────────
 * Usage:
 *   node scripts/postman-sync.js --export          writes postman-collection.json
 *   node scripts/postman-sync.js --push            pushes to Postman API
 *   node scripts/postman-sync.js --export --push   both
 *
 * Env vars required for --push:
 *   POSTMAN_API_KEY             your Postman API key (Settings → API Keys)
 *   POSTMAN_COLLECTION_UID      uid of existing collection to update (optional —
 *                               omit to create new; the uid is printed after first run)
 * ──────────────────────────────────────────────────────────────────
 *
 * Postman Environment variables to set up (see bottom of this file):
 *   base_url                   e.g. http://localhost:3000 (or Vercel URL)
 *   supabase_url               e.g. https://xxxx.supabase.co
 *   project_ref                the xxxx part from supabase_url
 *   supabase_service_role_key  service_role secret key (Settings → API)
 *   supabase_anon_key          anon public key (Settings → API)
 *   admin_email                felixmcauliffe@gmail.com
 *   admin_password             your Supabase auth password
 *   cron_secret                juice-cron-secret-2026
 *   auth_cookie_value          (auto-set by pre-request script — leave blank)
 *   token_expires_at           (auto-set by pre-request script — leave blank)
 *   lead_id                    a real lead UUID for parameterised requests
 *   subscription_id            a real subscription UUID
 *   address_id                 a real address UUID
 *   contact_id                 a real user UUID (auth.users id)
 *   opportunity_id             a real subscription UUID (admin view)
 *   campaign_id                a real email_campaigns UUID
 *   automation_id              a real email_automation_rules UUID
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');

// ──────────────────────────────────────────────────────────────────────────────
// Builder helpers
// ──────────────────────────────────────────────────────────────────────────────

const v = (name) => `{{${name}}}`;

function hdr(key, value) { return { key, value }; }
function jsonHdr()        { return hdr('Content-Type', 'application/json'); }
function preferCount()    { return hdr('Prefer', 'count=exact'); }
function preferSingle()   { return hdr('Prefer', 'return=representation'); }

function serviceRoleHdrs() {
  return [
    hdr('apikey',        v('supabase_service_role_key')),
    hdr('Authorization', `Bearer ${v('supabase_service_role_key')}`),
    jsonHdr(),
  ];
}

function appHdrs() {
  return [
    jsonHdr(),
    hdr('Cookie', `sb-${v('project_ref')}-auth-token=${v('auth_cookie_value')}`),
  ];
}

function cronHdrs() {
  return [
    jsonHdr(),
    hdr('Authorization', `Bearer ${v('cron_secret')}`),
  ];
}

// Build a URL object for Postman v2.1
function url(base, pathSegs, queryParams = [], pathVars = []) {
  const pathStr = pathSegs.join('/');
  let raw = `${base}/${pathStr}`;
  if (queryParams.length) {
    const activeQ = queryParams.filter(q => !q.disabled);
    if (activeQ.length) raw += '?' + activeQ.map(q => `${q.key}=${q.value}`).join('&');
  }

  const obj = {
    raw,
    host:  [base],
    path:  pathSegs,
  };
  if (queryParams.length) {
    obj.query = queryParams.map(q => ({
      key:      q.key,
      value:    q.value,
      disabled: q.disabled || false,
      description: q.description || '',
    }));
  }
  if (pathVars.length) {
    obj.variable = pathVars.map(pv => ({
      key:         pv.key,
      value:       pv.value || v(pv.key),
      description: pv.description || '',
    }));
  }
  return obj;
}

// Build a raw JSON body
function rawBody(obj) {
  return {
    mode: 'raw',
    raw:  JSON.stringify(obj, null, 2),
    options: { raw: { language: 'json' } },
  };
}

// Build a full request item
function req(name, method, urlObj, headers, body) {
  const item = { name, request: { method, header: headers, url: urlObj } };
  if (body) item.request.body = body;
  return item;
}

// Build a folder
function folder(name, description, items, prereqScript) {
  const f = { name, description, item: items };
  if (prereqScript) {
    f.event = [{
      listen: 'prerequest',
      script: { type: 'text/javascript', exec: prereqScript.split('\n') },
    }];
  }
  return f;
}

// ──────────────────────────────────────────────────────────────────────────────
// Pre-request script (auto sign-in for authenticated / admin folders)
// ──────────────────────────────────────────────────────────────────────────────

const AUTH_PREREQ = `
// Auto sign-in: exchanges admin_email + admin_password for a Supabase session
// and stores the result as the auth cookie used by the Next.js app routes.
const supabaseUrl = pm.environment.get('supabase_url');
const email       = pm.environment.get('admin_email');
const password    = pm.environment.get('admin_password');
const anonKey     = pm.environment.get('supabase_anon_key');

const expiresAt = parseInt(pm.environment.get('token_expires_at') || '0');
const now       = Math.floor(Date.now() / 1000);

if (now > expiresAt - 60) {
  pm.sendRequest({
    url:    supabaseUrl + '/auth/v1/token?grant_type=password',
    method: 'POST',
    header: [
      { key: 'Content-Type', value: 'application/json' },
      { key: 'apikey',       value: anonKey },
    ],
    body: {
      mode: 'raw',
      raw:  JSON.stringify({ email, password }),
    },
  }, function(err, res) {
    if (!err && res.code === 200) {
      const b = res.json();
      // @supabase/ssr reads the session cookie as URL-encoded JSON
      pm.environment.set('auth_cookie_value', encodeURIComponent(JSON.stringify(b)));
      pm.environment.set('token_expires_at',  String(b.expires_at));
    } else {
      console.error('Auth pre-request failed', err, res && res.code);
    }
  });
}
`.trim();

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Supabase Direct (data-audit)
// ──────────────────────────────────────────────────────────────────────────────

function supabaseGet(name, table, queryParams = []) {
  const base = `${v('supabase_url')}/rest/v1`;
  return req(
    name,
    'GET',
    url(base, [table], [
      { key: 'select', value: '*' },
      { key: 'order',  value: 'created_at.desc' },
      { key: 'limit',  value: '100' },
      ...queryParams,
    ]),
    [...serviceRoleHdrs(), preferCount()],
  );
}

function supabaseGetById(name, table) {
  const base = `${v('supabase_url')}/rest/v1`;
  return req(
    name,
    'GET',
    url(
      base,
      [table],
      [{ key: 'id', value: `eq.${v('record_id')}` }, { key: 'select', value: '*' }],
    ),
    [...serviceRoleHdrs(), hdr('Accept', 'application/vnd.pgrst.object+json')],
  );
}

const supabaseDirectFolder = folder(
  '📊 Supabase Direct (data-audit)',
  'Direct PostgREST queries using the service-role key — bypasses all RLS. Use for data audit, debugging, and admin queries.',
  [
    // leads
    folder('leads', 'public.leads — funnel submissions + CRM data', [
      supabaseGet('All leads', 'leads'),
      supabaseGet('Unconverted leads', 'leads', [
        { key: 'signup_complete', value: 'eq.false' },
      ]),
      supabaseGet('Converted leads', 'leads', [
        { key: 'signup_complete', value: 'eq.true' },
      ]),
      supabaseGet('Leads by CRM status (new)', 'leads', [
        { key: 'crm_status', value: 'eq.new' },
      ]),
      supabaseGetById('Get lead by id', 'leads'),
    ]),

    // subscriptions
    folder('subscriptions', 'public.subscriptions', [
      supabaseGet('All subscriptions', 'subscriptions'),
      supabaseGet('Active subscriptions', 'subscriptions', [
        { key: 'status', value: 'eq.active' },
      ]),
      supabaseGet('Pending subscriptions', 'subscriptions', [
        { key: 'status', value: 'eq.pending' },
      ]),
      supabaseGetById('Get subscription by id', 'subscriptions'),
    ]),

    // orders
    folder('orders', 'public.orders — one-off orders', [
      supabaseGet('All orders', 'orders'),
      supabaseGet('Completed orders', 'orders', [
        { key: 'status', value: 'eq.active' },
      ]),
      supabaseGetById('Get order by id', 'orders'),
    ]),

    // ingredients
    folder('ingredients', 'public.ingredients — product catalogue (read-only)', [
      req(
        'All ingredients',
        'GET',
        url(`${v('supabase_url')}/rest/v1`, ['ingredients'], [
          { key: 'select', value: '*' },
          { key: 'order', value: 'slug.asc' },
        ]),
        serviceRoleHdrs(),
      ),
    ]),

    // addresses
    folder('addresses', 'public.addresses — user delivery/billing addresses', [
      supabaseGet('All addresses', 'addresses'),
    ]),

    // email_logs
    folder('email_logs', 'public.email_logs — every email sent by the system', [
      supabaseGet('All email logs', 'email_logs'),
      supabaseGet('Failed emails', 'email_logs', [
        { key: 'status', value: 'eq.failed' },
      ]),
      supabaseGet('Emails last 7 days', 'email_logs', [
        { key: 'created_at', value: 'gte.' + new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0] },
      ]),
    ]),

    // email_campaigns
    folder('email_campaigns', 'public.email_campaigns — admin bulk campaigns', [
      supabaseGet('All campaigns', 'email_campaigns'),
      supabaseGet('Sent campaigns', 'email_campaigns', [
        { key: 'status', value: 'eq.sent' },
      ]),
    ]),

    // email_automation_rules
    folder('email_automation_rules', 'public.email_automation_rules', [
      supabaseGet('All automation rules', 'email_automation_rules'),
      supabaseGet('Enabled automation rules', 'email_automation_rules', [
        { key: 'enabled', value: 'eq.true' },
      ]),
    ]),

    // lead_notes
    folder('lead_notes', 'public.lead_notes — CRM activity log', [
      supabaseGet('All lead notes', 'lead_notes'),
    ]),

    // SQL RPC
    folder('SQL RPC', 'Direct SQL execution via the admin_exec_query function', [
      req(
        'Execute SQL (admin_exec_query)',
        'POST',
        url(`${v('supabase_url')}/rest/v1`, ['rpc', 'admin_exec_query']),
        serviceRoleHdrs(),
        rawBody({ query: 'SELECT id, email, crm_status, created_at::date FROM public.leads ORDER BY created_at DESC LIMIT 50;' }),
      ),
    ]),
  ],
);

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Auth (get session for browser-like testing)
// ──────────────────────────────────────────────────────────────────────────────

const authFolder = folder(
  '🔑 Auth',
  'Sign in to get a session. The pre-request script on the Authenticated and Admin folders does this automatically — use these manually if needed.',
  [
    req(
      'Sign in (email + password)',
      'POST',
      url(`${v('supabase_url')}/auth/v1`, ['token'], [{ key: 'grant_type', value: 'password' }]),
      [hdr('apikey', v('supabase_anon_key')), jsonHdr()],
      rawBody({ email: v('admin_email'), password: v('admin_password') }),
    ),
    req(
      'Sign out',
      'POST',
      url(`${v('supabase_url')}/auth/v1`, ['logout']),
      [
        hdr('apikey',        v('supabase_anon_key')),
        hdr('Authorization', `Bearer ${v('auth_cookie_value')}`),
        jsonHdr(),
      ],
    ),
    req(
      'Get current user',
      'GET',
      url(`${v('supabase_url')}/auth/v1`, ['user']),
      [
        hdr('apikey',        v('supabase_anon_key')),
        hdr('Authorization', `Bearer ${v('access_token')}`),
      ],
    ),
  ],
);

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 3 — App API — Public (no auth)
// ──────────────────────────────────────────────────────────────────────────────

const publicApiFolder = folder(
  '🌐 App API — Public',
  'No authentication required. These are the funnel capture endpoints.',
  [
    req(
      'POST /api/lead — Step 1 (partial)',
      'POST',
      url(v('base_url'), ['api', 'lead']),
      [jsonHdr()],
      rawBody({
        email:   'test@example.com',
        company: 'Acme Corp',
        role:    'HR Manager',
      }),
    ),
    req(
      'POST /api/lead — Full submission (step-4 fallback)',
      'POST',
      url(v('base_url'), ['api', 'lead']),
      [jsonHdr()],
      rawBody({
        email:                  'test@example.com',
        company:                'Acme Corp',
        role:                   'HR Manager',
        frequency:              'weekly',
        quantity_tier:          '1.0',
        team_size:              20,
        ingredients:            ['allinone_shot', 'turmeric_shot'],
        shots_per_drop:         20,
        bottles_per_drop:       0,
        shots_per_month:        80,
        bottles_per_month:      0,
        price_per_drop_ex_vat:  70.00,
        price_per_month_ex_vat: 280.00,
        vat_per_month:          56.00,
        total_per_month_inc_vat: 336.00,
      }),
    ),
    req(
      'PATCH /api/lead/:id — Update lead (step 4)',
      'PATCH',
      url(v('base_url'), ['api', 'lead', ':id'], [], [{ key: 'id', value: v('lead_id'), description: 'Lead UUID' }]),
      [jsonHdr()],
      rawBody({
        frequency:              'weekly',
        quantity_tier:          '1.0',
        team_size:              20,
        ingredients:            ['allinone_shot'],
        shots_per_drop:         20,
        bottles_per_drop:       0,
        shots_per_month:        80,
        bottles_per_month:      0,
        price_per_drop_ex_vat:  70.00,
        price_per_month_ex_vat: 280.00,
        vat_per_month:          56.00,
        total_per_month_inc_vat: 336.00,
      }),
    ),
  ],
);

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 4 — App API — Authenticated (user session required)
// ──────────────────────────────────────────────────────────────────────────────

const authenticatedApiFolder = folder(
  '🔐 App API — Authenticated',
  'Requires a valid user session. Pre-request script auto-signs in using admin_email + admin_password.',
  [
    // Subscriptions
    folder('Subscriptions', '', [
      req(
        'GET /api/subscription',
        'GET',
        url(v('base_url'), ['api', 'subscription']),
        appHdrs(),
      ),
      req(
        'POST /api/subscription',
        'POST',
        url(v('base_url'), ['api', 'subscription']),
        appHdrs(),
        rawBody({
          frequency:              'weekly',
          team_size:              20,
          quantity_tier:          '1.0',
          ingredients:            ['allinone_shot'],
          shots_per_drop:         20,
          bottles_per_drop:       0,
          shots_per_month:        80,
          bottles_per_month:      0,
          price_per_drop_ex_vat:  70.00,
          price_per_month_ex_vat: 280.00,
          vat_per_month:          56.00,
          total_per_month_inc_vat: 336.00,
          lead_id:                null,
        }),
      ),
      req(
        'PATCH /api/subscription/:id',
        'PATCH',
        url(v('base_url'), ['api', 'subscription', ':id'], [], [{ key: 'id', value: v('subscription_id'), description: 'Subscription UUID' }]),
        appHdrs(),
        rawBody({ status: 'paused' }),
      ),
    ]),

    // Addresses
    folder('Addresses', '', [
      req(
        'GET /api/address',
        'GET',
        url(v('base_url'), ['api', 'address'], [{ key: 'type', value: 'delivery', disabled: true, description: '"delivery" or "billing"' }]),
        appHdrs(),
      ),
      req(
        'POST /api/address',
        'POST',
        url(v('base_url'), ['api', 'address']),
        appHdrs(),
        rawBody({
          type:       'delivery',
          label:      'Office',
          line1:      '1 Example Street',
          line2:      '',
          city:       'London',
          postcode:   'SE1 6QF',
          country:    'GB',
          is_default: true,
        }),
      ),
      req(
        'PATCH /api/address/:id',
        'PATCH',
        url(v('base_url'), ['api', 'address', ':id'], [], [{ key: 'id', value: v('address_id'), description: 'Address UUID' }]),
        appHdrs(),
        rawBody({ label: 'Updated label', is_default: false }),
      ),
      req(
        'DELETE /api/address/:id',
        'DELETE',
        url(v('base_url'), ['api', 'address', ':id'], [], [{ key: 'id', value: v('address_id'), description: 'Address UUID' }]),
        appHdrs(),
      ),
      req(
        'GET /api/address/lookup?postcode= (postcode autocomplete)',
        'GET',
        url(v('base_url'), ['api', 'address', 'lookup'], [{ key: 'postcode', value: 'SE16QF', description: 'UK postcode — no spaces' }]),
        appHdrs(),
      ),
    ]),

    // Account
    folder('Account', '', [
      req(
        'PATCH /api/account (update display name)',
        'PATCH',
        url(v('base_url'), ['api', 'account']),
        appHdrs(),
        rawBody({ display_name: 'Felix M' }),
      ),
    ]),

    // Checkout
    folder('Checkout', '', [
      req(
        'POST /api/checkout/session — Subscription',
        'POST',
        url(v('base_url'), ['api', 'checkout', 'session']),
        appHdrs(),
        rawBody({
          mode:      'subscription',
          frequency: 'weekly',
          lineItems: [
            { productSlug: 'allinone_shot', format: 'shot', quantity: 20 },
          ],
          addressId:     null,
          newAddress:    {
            line1:         '1 Example Street',
            city:          'London',
            postcode:      'SE1 6QF',
            saveToAccount: true,
          },
          saveDraft: false,
        }),
      ),
      req(
        'POST /api/checkout/session — One-off order',
        'POST',
        url(v('base_url'), ['api', 'checkout', 'session']),
        appHdrs(),
        rawBody({
          mode:          'one_off',
          deliveryDate:  '2026-05-15',
          deliveryNotes: '',
          lineItems: [
            { productSlug: 'allinone_shot', format: 'shot', quantity: 20 },
          ],
          addressId:  null,
          newAddress: {
            line1:         '1 Example Street',
            city:          'London',
            postcode:      'SE1 6QF',
            saveToAccount: false,
          },
          saveDraft: false,
        }),
      ),
      req(
        'POST /api/checkout/session — Save draft (no Stripe)',
        'POST',
        url(v('base_url'), ['api', 'checkout', 'session']),
        appHdrs(),
        rawBody({
          mode:      'subscription',
          frequency: 'weekly',
          lineItems: [
            { productSlug: 'allinone_shot', format: 'shot', quantity: 20 },
          ],
          saveDraft: true,
        }),
      ),
      req(
        'GET /api/checkout/session/:id (return page status)',
        'GET',
        url(v('base_url'), ['api', 'checkout', 'session', ':id'], [], [{ key: 'id', value: 'cs_test_...', description: 'Stripe Checkout Session ID' }]),
        appHdrs(),
      ),
    ]),

    // Billing
    folder('Billing', '', [
      req(
        'POST /api/billing/portal (get Stripe Customer Portal URL)',
        'POST',
        url(v('base_url'), ['api', 'billing', 'portal']),
        appHdrs(),
      ),
    ]),

    // Orders
    folder('Orders', '', [
      req(
        'GET /api/orders',
        'GET',
        url(v('base_url'), ['api', 'orders']),
        appHdrs(),
      ),
    ]),
  ],
  AUTH_PREREQ,
);

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 5 — App API — Admin
// ──────────────────────────────────────────────────────────────────────────────

const adminApiFolder = folder(
  '🔑 App API — Admin',
  'Requires admin session (ADMIN_EMAILS env var). Pre-request script auto-signs in as admin_email.',
  [
    // Leads
    folder('Leads', '', [
      req(
        'GET /api/admin/leads',
        'GET',
        url(v('base_url'), ['api', 'admin', 'leads'], [
          { key: 'q',         value: '',       disabled: true, description: 'Search email/company/role' },
          { key: 'status',    value: 'new',    disabled: true, description: 'new|contacted|qualified|proposal|converted|lost' },
          { key: 'source',    value: '',       disabled: true, description: 'landing_page|cold_outreach|referral|event|other' },
          { key: 'converted', value: 'false',  disabled: true, description: 'true|false' },
          { key: 'limit',     value: '100' },
          { key: 'offset',    value: '0' },
        ]),
        appHdrs(),
      ),
      req(
        'GET /api/admin/leads/:id',
        'GET',
        url(v('base_url'), ['api', 'admin', 'leads', ':id'], [], [{ key: 'id', value: v('lead_id') }]),
        appHdrs(),
      ),
      req(
        'PATCH /api/admin/leads/:id (update CRM fields)',
        'PATCH',
        url(v('base_url'), ['api', 'admin', 'leads', ':id'], [], [{ key: 'id', value: v('lead_id') }]),
        appHdrs(),
        rawBody({
          crm_status:        'contacted',
          crm_source:        'landing_page',
          last_contacted_at: new Date().toISOString(),
        }),
      ),
      req(
        'POST /api/admin/leads/:id (add note)',
        'POST',
        url(v('base_url'), ['api', 'admin', 'leads', ':id'], [], [{ key: 'id', value: v('lead_id') }]),
        appHdrs(),
        rawBody({
          note:      'Spoke on phone — interested in weekly shots for 20 pax.',
          note_type: 'call',
        }),
      ),
      req(
        'DELETE /api/admin/leads/:id',
        'DELETE',
        url(v('base_url'), ['api', 'admin', 'leads', ':id'], [], [{ key: 'id', value: v('lead_id') }]),
        appHdrs(),
      ),
    ]),

    // Contacts
    folder('Contacts', '', [
      req(
        'GET /api/admin/contacts',
        'GET',
        url(v('base_url'), ['api', 'admin', 'contacts'], [
          { key: 'q', value: '', disabled: true, description: 'Search email/name/company' },
        ]),
        appHdrs(),
      ),
      req(
        'GET /api/admin/contacts/:id',
        'GET',
        url(v('base_url'), ['api', 'admin', 'contacts', ':id'], [], [{ key: 'id', value: v('contact_id'), description: 'auth.users UUID' }]),
        appHdrs(),
      ),
    ]),

    // Accounts
    folder('Accounts', '', [
      req(
        'GET /api/admin/accounts',
        'GET',
        url(v('base_url'), ['api', 'admin', 'accounts'], [
          { key: 'q', value: '', disabled: true, description: 'Search company name' },
        ]),
        appHdrs(),
      ),
    ]),

    // Opportunities
    folder('Opportunities', '', [
      req(
        'GET /api/admin/opportunities',
        'GET',
        url(v('base_url'), ['api', 'admin', 'opportunities'], [
          { key: 'status', value: 'active', disabled: true, description: 'pending|active|paused|cancelled' },
          { key: 'q',      value: '',       disabled: true, description: 'Search email/company' },
        ]),
        appHdrs(),
      ),
      req(
        'PATCH /api/admin/opportunities/:id',
        'PATCH',
        url(v('base_url'), ['api', 'admin', 'opportunities', ':id'], [], [{ key: 'id', value: v('opportunity_id') }]),
        appHdrs(),
        rawBody({ status: 'active' }),
      ),
    ]),

    // Emails
    folder('Emails', '', [
      req(
        'GET /api/admin/emails (email log)',
        'GET',
        url(v('base_url'), ['api', 'admin', 'emails'], [
          { key: 'q',        value: '',      disabled: true, description: 'Filter by to_email' },
          { key: 'template', value: '',      disabled: true, description: 'Filter by template_name' },
          { key: 'status',   value: 'sent',  disabled: true, description: 'sent|failed' },
          { key: 'limit',    value: '100' },
          { key: 'offset',   value: '0' },
        ]),
        appHdrs(),
      ),

      // Campaigns
      req(
        'GET /api/admin/emails/campaigns',
        'GET',
        url(v('base_url'), ['api', 'admin', 'emails', 'campaigns']),
        appHdrs(),
      ),
      req(
        'POST /api/admin/emails/campaigns (create)',
        'POST',
        url(v('base_url'), ['api', 'admin', 'emails', 'campaigns']),
        appHdrs(),
        rawBody({
          name:      'April Re-engagement',
          subject:   'We miss you — fresh juice just dropped',
          body_html: '<p>Hey {{name}}, your team deserves a juice boost.</p>',
          target:    'unconverted_leads',
        }),
      ),
      req(
        'PATCH /api/admin/emails/campaigns/:id (update / send)',
        'PATCH',
        url(v('base_url'), ['api', 'admin', 'emails', 'campaigns', ':id'], [], [{ key: 'id', value: v('campaign_id') }]),
        appHdrs(),
        rawBody({ status: 'sent' }),
      ),
      req(
        'DELETE /api/admin/emails/campaigns/:id',
        'DELETE',
        url(v('base_url'), ['api', 'admin', 'emails', 'campaigns', ':id'], [], [{ key: 'id', value: v('campaign_id') }]),
        appHdrs(),
      ),

      // Automations
      req(
        'GET /api/admin/emails/automations',
        'GET',
        url(v('base_url'), ['api', 'admin', 'emails', 'automations']),
        appHdrs(),
      ),
      req(
        'POST /api/admin/emails/automations (create)',
        'POST',
        url(v('base_url'), ['api', 'admin', 'emails', 'automations']),
        appHdrs(),
        rawBody({
          name:           'Lead Follow-up 14d',
          description:    'Follow up with unconverted leads after 14 days',
          trigger_event:  'lead_age_hours',
          delay_hours:    336,
          template_name:  'lead_followup_7d',
          subject:        'Still thinking about it?',
          body_html:      '<p>Hi there, just checking in...</p>',
          enabled:        false,
          conditions:     {},
        }),
      ),
      req(
        'PATCH /api/admin/emails/automations/:id (enable/disable/edit)',
        'PATCH',
        url(v('base_url'), ['api', 'admin', 'emails', 'automations', ':id'], [], [{ key: 'id', value: v('automation_id') }]),
        appHdrs(),
        rawBody({ enabled: false }),
      ),
      req(
        'DELETE /api/admin/emails/automations/:id',
        'DELETE',
        url(v('base_url'), ['api', 'admin', 'emails', 'automations', ':id'], [], [{ key: 'id', value: v('automation_id') }]),
        appHdrs(),
      ),
    ]),

    // Reports
    folder('Reports', '', [
      req(
        'GET /api/admin/reports',
        'GET',
        url(v('base_url'), ['api', 'admin', 'reports']),
        appHdrs(),
      ),
    ]),

    // Billing
    folder('Admin Billing', '', [
      req(
        'GET /api/admin/billing',
        'GET',
        url(v('base_url'), ['api', 'admin', 'billing']),
        appHdrs(),
      ),
    ]),

    // AI Query
    folder('AI Query', '', [
      req(
        'POST /api/admin/query (AI natural-language SQL)',
        'POST',
        url(v('base_url'), ['api', 'admin', 'query']),
        appHdrs(),
        rawBody({ question: 'How many active subscriptions do we have?' }),
      ),
    ]),
  ],
  AUTH_PREREQ,
);

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 6 — Internal (cron + webhooks)
// ──────────────────────────────────────────────────────────────────────────────

const internalFolder = folder(
  '🤖 Internal',
  'Cron jobs and Stripe webhooks. These use special auth (Bearer cron_secret or Stripe signature).',
  [
    req(
      'GET /api/cron/emails (trigger hourly email cron)',
      'GET',
      url(v('base_url'), ['api', 'cron', 'emails']),
      cronHdrs(),
    ),
    req(
      'POST /api/webhooks/stripe (test event shape)',
      'POST',
      url(v('base_url'), ['api', 'webhooks', 'stripe']),
      [jsonHdr(), hdr('stripe-signature', 't=...,v1=...')],
      rawBody({
        id:   'evt_test_...',
        type: 'checkout.session.completed',
        data: {
          object: {
            id:       'cs_test_...',
            metadata: { supabase_subscription_id: v('subscription_id'), supabase_user_id: v('contact_id') },
          },
        },
      }),
    ),
  ],
);

// ──────────────────────────────────────────────────────────────────────────────
// Assemble collection
// ──────────────────────────────────────────────────────────────────────────────

const collection = {
  info: {
    name:        'Juice for Teams',
    description: 'Complete API collection for the Juice for Teams Next.js app (Vercel) and direct Supabase REST access for data-audit. Generated by scripts/postman-sync.js',
    schema:      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'base_url',                 value: 'http://localhost:3000',    type: 'string', description: 'Next.js app URL (local or Vercel)' },
    { key: 'supabase_url',             value: 'https://xxxx.supabase.co', type: 'string', description: 'Supabase project URL — Settings → API → Project URL' },
    { key: 'project_ref',              value: 'xxxx',                     type: 'string', description: 'The xxxx part of your supabase_url (used to build cookie name)' },
    { key: 'supabase_service_role_key', value: '',                         type: 'string', description: 'Service-role secret key — Settings → API → service_role (keep secret!)' },
    { key: 'supabase_anon_key',        value: '',                         type: 'string', description: 'Anon/publishable key — Settings → API → anon public' },
    { key: 'admin_email',              value: 'felixmcauliffe@gmail.com', type: 'string', description: 'Admin user email — used by pre-request auto sign-in' },
    { key: 'admin_password',           value: '',                         type: 'string', description: 'Admin user password — used by pre-request auto sign-in' },
    { key: 'cron_secret',              value: 'juice-cron-secret-2026',   type: 'string', description: 'Matches CRON_SECRET env var' },
    { key: 'auth_cookie_value',        value: '',                         type: 'string', description: 'Auto-populated by pre-request script — do not edit' },
    { key: 'token_expires_at',         value: '0',                        type: 'string', description: 'Auto-populated by pre-request script — do not edit' },
    { key: 'access_token',             value: '',                         type: 'string', description: 'Auto-populated by pre-request script' },
    { key: 'lead_id',                  value: '',                         type: 'string', description: 'UUID of a real lead row — paste from Supabase Direct queries' },
    { key: 'subscription_id',          value: '',                         type: 'string', description: 'UUID of a real subscription row' },
    { key: 'address_id',               value: '',                         type: 'string', description: 'UUID of a real address row' },
    { key: 'contact_id',               value: '',                         type: 'string', description: 'UUID from auth.users (use GET /api/admin/contacts)' },
    { key: 'opportunity_id',           value: '',                         type: 'string', description: 'UUID of a subscription (admin opportunities view)' },
    { key: 'campaign_id',              value: '',                         type: 'string', description: 'UUID of a real email_campaigns row' },
    { key: 'automation_id',            value: '',                         type: 'string', description: 'UUID of a real email_automation_rules row' },
    { key: 'record_id',                value: '',                         type: 'string', description: 'Generic UUID used by Supabase Direct single-row GETs' },
  ],
  item: [
    authFolder,
    supabaseDirectFolder,
    publicApiFolder,
    authenticatedApiFolder,
    adminApiFolder,
    internalFolder,
  ],
};

// ──────────────────────────────────────────────────────────────────────────────
// Export + Postman API sync
// ──────────────────────────────────────────────────────────────────────────────

function exportFile() {
  const outPath = path.join(__dirname, 'postman-collection.json');
  fs.writeFileSync(outPath, JSON.stringify({ collection }, null, 2), 'utf8');
  console.log(`✅  Exported → ${outPath}`);
  return outPath;
}

function postmanRequest(method, urlPath, body, apiKey) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.getpostman.com',
      path:     urlPath,
      method,
      headers: {
        'X-API-Key':    apiKey,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let buf = '';
      res.on('data', (chunk) => { buf += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function pushToPostman() {
  const apiKey = process.env.POSTMAN_API_KEY;
  if (!apiKey) {
    console.error('❌  POSTMAN_API_KEY env var not set. Get yours at: https://go.postman.co/settings/me/api-keys');
    process.exit(1);
  }

  const collectionUid = process.env.POSTMAN_COLLECTION_UID;

  if (collectionUid) {
    // Update existing collection
    console.log(`⬆️   Updating collection ${collectionUid} …`);
    const res = await postmanRequest('PUT', `/collections/${collectionUid}`, { collection }, apiKey);
    if (res.status === 200) {
      console.log(`✅  Updated collection: https://go.postman.co/collections/${collectionUid}`);
    } else {
      console.error(`❌  Postman API error (${res.status}):`, JSON.stringify(res.body, null, 2));
      process.exit(1);
    }
  } else {
    // Create new collection
    console.log('🆕  Creating new collection …');
    const res = await postmanRequest('POST', '/collections', { collection }, apiKey);
    if (res.status === 200 || res.status === 201) {
      const uid = res.body.collection?.uid;
      console.log(`✅  Created collection: ${uid}`);
      console.log(`    Set this in your env to enable updates:`);
      console.log(`    POSTMAN_COLLECTION_UID=${uid}`);
      console.log(`    View at: https://go.postman.co/collections/${uid}`);
    } else {
      console.error(`❌  Postman API error (${res.status}):`, JSON.stringify(res.body, null, 2));
      process.exit(1);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const doExport = args.includes('--export') || args.includes('-e');
const doPush   = args.includes('--push')   || args.includes('-p');

if (!doExport && !doPush) {
  console.log('Usage:');
  console.log('  node scripts/postman-sync.js --export          # write postman-collection.json');
  console.log('  node scripts/postman-sync.js --push            # push to Postman API');
  console.log('  node scripts/postman-sync.js --export --push   # both');
  process.exit(0);
}

(async () => {
  if (doExport) exportFile();
  if (doPush)   await pushToPostman();
})();
