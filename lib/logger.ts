/**
 * lib/logger.ts
 * Structured console logger for Next.js API routes.
 *
 * Usage:
 *   import { createLogger } from "@/lib/logger";
 *   const log = createLogger("prospects/route");
 *
 *   log.input("POST /api/admin/prospects", { email, category });
 *   log.db("INSERT prospect_contacts", { email, quality_score: 75 });
 *   log.dbResult("contact created", { id, email });
 *   log.transform("computed quality score", { score: 75 });
 *   log.error("insert failed", { message: error.message });
 *   log.done("request complete", { status: 201 });
 */

type Meta = Record<string, unknown>;

// ANSI escape codes — gracefully ignored in environments that don't support them
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  gray:    '\x1b[90m',
  white:   '\x1b[37m',
  cyan:    '\x1b[36m',
  blue:    '\x1b[34m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
};

const LEVEL_COLOR: Record<string, string> = {
  'INFO':      C.white,
  'INPUT':     C.cyan,
  'DB':        C.blue,
  'DB ✓':      C.green,
  'TRANSFORM': C.magenta,
  'RESULT':    C.green,
  'WARN':      C.yellow,
  'ERROR':     C.red,
  'DONE ✓':    C.green,
};

function formatMeta(meta?: Meta): string {
  if (!meta) return '';
  const entries = Object.entries(meta);
  if (entries.length === 0) return '';
  const parts = entries.map(([k, v]) => {
    if (v === null || v === undefined) return `${k}=null`;
    if (Array.isArray(v)) return `${k}=[${v.join(',')}]`;
    if (typeof v === 'object') return `${k}=${JSON.stringify(v)}`;
    return `${k}=${String(v)}`;
  });
  return '  ' + parts.join('  ');
}

function write(route: string, level: string, msg: string, meta?: Meta): void {
  const ts    = new Date().toISOString().replace('T', ' ').slice(0, 23); // 2026-04-17 10:23:41.123
  const color = LEVEL_COLOR[level] ?? C.white;
  const pad   = level.padEnd(9); // consistent column width (longest = TRANSFORM at 9)
  console.log(
    `${C.gray}${ts}${C.reset}  ` +
    `${C.dim}[${route}]${C.reset}  ` +
    `${color}${C.bold}${pad}${C.reset}  ` +
    `${msg}` +
    `${C.dim}${formatMeta(meta)}${C.reset}`
  );
}

export interface Logger {
  /** General informational message */
  info:      (msg: string, meta?: Meta) => void;
  /** Inbound request parameters / body fields */
  input:     (msg: string, meta?: Meta) => void;
  /** Supabase query being executed */
  db:        (msg: string, meta?: Meta) => void;
  /** Supabase query result */
  dbResult:  (msg: string, meta?: Meta) => void;
  /** Data transformation / computation */
  transform: (msg: string, meta?: Meta) => void;
  /** Outbound response / final computed value */
  result:    (msg: string, meta?: Meta) => void;
  /** Non-fatal warning */
  warn:      (msg: string, meta?: Meta) => void;
  /** Error (fatal to this request) */
  error:     (msg: string, meta?: Meta) => void;
  /** Request completed successfully */
  done:      (msg: string, meta?: Meta) => void;
}

export function createLogger(route: string): Logger {
  return {
    info:      (msg, meta) => write(route, 'INFO',      msg, meta),
    input:     (msg, meta) => write(route, 'INPUT',     msg, meta),
    db:        (msg, meta) => write(route, 'DB',        msg, meta),
    dbResult:  (msg, meta) => write(route, 'DB ✓',      msg, meta),
    transform: (msg, meta) => write(route, 'TRANSFORM', msg, meta),
    result:    (msg, meta) => write(route, 'RESULT',    msg, meta),
    warn:      (msg, meta) => write(route, 'WARN',      msg, meta),
    error:     (msg, meta) => write(route, 'ERROR',     msg, meta),
    done:      (msg, meta) => write(route, 'DONE ✓',    msg, meta),
  };
}
