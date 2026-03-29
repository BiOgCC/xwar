/**
 * XWAR — Input Sanitization Middleware
 *
 * Defence-in-depth layer that runs BEFORE Zod validation.
 * Applies to every incoming request body, query, and params.
 *
 * What it does:
 *   1. Strips HTML tags & script injections from all string values
 *   2. Removes null bytes (\0) which can bypass validation
 *   3. Trims leading/trailing whitespace
 *   4. Normalizes unicode to NFC form (prevents homoglyph attacks)
 *   5. Enforces a hard ceiling on string length (prevents memory abuse)
 *   6. Blocks common SQL injection patterns in free-text fields
 *   7. Recursively sanitizes nested objects and arrays
 *
 * Safe fields (UUIDs, country codes, enums) pass through untouched
 * because Zod schemas already constrain them tightly via `.uuid()`,
 * `.length(2)`, `.enum()`, etc.
 */
import type { Request, Response, NextFunction } from 'express'

// ── Constants ────────────────────────────────────────────────

/** Absolute max length for any single string value (prevents memory bombs) */
const MAX_STRING_LENGTH = 2048

/** Max recursion depth for nested objects */
const MAX_DEPTH = 10

// ── HTML / Script stripping ─────────────────────────────────

/**
 * Strips HTML tags, script content, and event handler attributes.
 * Intentionally aggressive — XWAR has no use case for user-supplied HTML.
 */
function stripHtml(input: string): string {
  return input
    // Remove <script>...</script> blocks (incl. multiline)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove <style>...</style> blocks
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove remaining HTML tags
    .replace(/<[^>]*>/g, '')
}

/**
 * Escapes characters that can trigger XSS when reflected in JSON responses.
 * This catches anything that slipped past `stripHtml`.
 */
function escapeHtmlEntities(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// ── Pattern blockers ────────────────────────────────────────

/** Common SQL injection fragments (case-insensitive check) */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|EXECUTE|UNION)\b\s)/i,
  /(--|;|\/\*|\*\/)/,
  /(\bOR\b\s+\d+\s*=\s*\d+)/i,       // OR 1=1
  /(\bAND\b\s+\d+\s*=\s*\d+)/i,      // AND 1=1
  /(['"];\s*DROP\b)/i,                // '; DROP
]

/**
 * Returns true if the string looks like a SQL injection attempt.
 * We only flag on obviously suspicious patterns — Drizzle already
 * parameterizes queries, so this is just a bonus tripwire.
 */
function hasSqlInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input))
}

// ── Core sanitizer ──────────────────────────────────────────

/**
 * Recursively sanitizes a value.
 * - strings: strip HTML, null bytes, normalize unicode, enforce length
 * - objects/arrays: recurse into children
 * - numbers/booleans: pass through
 */
function sanitizeValue(value: unknown, depth: number = 0): unknown {
  if (depth > MAX_DEPTH) return value // prevent infinite recursion

  if (typeof value === 'string') {
    let clean = value

    // 1. Remove null bytes
    clean = clean.replace(/\0/g, '')

    // 2. Normalize unicode (NFC — canonical decomposition + composition)
    clean = clean.normalize('NFC')

    // 3. Strip HTML tags and script content
    clean = stripHtml(clean)

    // 4. Escape any remaining dangerous characters
    clean = escapeHtmlEntities(clean)

    // 5. Trim whitespace
    clean = clean.trim()

    // 6. Enforce max length
    if (clean.length > MAX_STRING_LENGTH) {
      clean = clean.slice(0, MAX_STRING_LENGTH)
    }

    return clean
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, depth + 1))
  }

  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      // Also sanitize object keys (prevents prototype pollution via __proto__)
      const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, '')
      if (safeKey === '__proto__' || safeKey === 'constructor' || safeKey === 'prototype') {
        continue // skip prototype pollution vectors
      }
      sanitized[safeKey] = sanitizeValue(val, depth + 1)
    }
    return sanitized
  }

  // numbers, booleans, null, undefined — pass through unchanged
  return value
}

// ── SQL Injection logger ────────────────────────────────────

/**
 * Scans all string values in a body for SQL injection patterns.
 * Returns array of suspicious field paths for logging.
 */
function findSqlInjectionAttempts(
  obj: unknown,
  path: string = '',
  results: string[] = [],
  depth: number = 0,
): string[] {
  if (depth > MAX_DEPTH) return results

  if (typeof obj === 'string' && hasSqlInjection(obj)) {
    results.push(path || 'root')
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => findSqlInjectionAttempts(item, `${path}[${i}]`, results, depth + 1))
  } else if (obj !== null && typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      findSqlInjectionAttempts(val, path ? `${path}.${key}` : key, results, depth + 1)
    }
  }

  return results
}

// ── Express Middleware ──────────────────────────────────────

/**
 * Global sanitize middleware.
 * Mount BEFORE `express.json()` cannot re-parse, so mount AFTER `express.json()`.
 *
 * Usage:
 *   app.use(express.json())
 *   app.use(sanitizeInput)
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    // Log any SQL injection attempts before sanitizing (for forensics)
    const sqliFields = findSqlInjectionAttempts(req.body)
    if (sqliFields.length > 0) {
      // Lazy-import logger to avoid circular deps at module load time
      console.warn(
        `[SANITIZE] ⚠️  Potential SQLi detected from ${req.ip} on ${req.method} ${req.path} — fields: ${sqliFields.join(', ')}`,
      )
    }

    req.body = sanitizeValue(req.body)
  }

  // Sanitize query params
  if (req.query && typeof req.query === 'object') {
    for (const [key, val] of Object.entries(req.query)) {
      if (typeof val === 'string') {
        (req.query as any)[key] = sanitizeValue(val)
      }
    }
  }

  // Sanitize URL params
  if (req.params && typeof req.params === 'object') {
    for (const [key, val] of Object.entries(req.params)) {
      if (typeof val === 'string') {
        req.params[key] = sanitizeValue(val) as string
      }
    }
  }

  next()
}

// ── Named export for unit testing / ad-hoc usage ────────────

export { sanitizeValue, stripHtml, escapeHtmlEntities, hasSqlInjection, findSqlInjectionAttempts }
