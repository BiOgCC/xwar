/**
 * Global error handler — catches unhandled errors in routes
 * Must be registered AFTER all routes in Express
 */
import type { Request, Response, NextFunction } from 'express'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[ERROR]', err.message, err.stack?.split('\n').slice(0, 3).join('\n'))

  // Drizzle / Postgres errors
  if ((err as any).code === '23505') {
    res.status(409).json({ error: 'Duplicate entry — this record already exists.' })
    return
  }
  if ((err as any).code === '23503') {
    res.status(400).json({ error: 'Invalid reference — related record not found.' })
    return
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({ error: 'Invalid or expired token.' })
    return
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    res.status(400).json({ error: 'Validation error', details: (err as any).issues })
    return
  }

  // Default
  res.status(500).json({ error: 'Internal server error' })
}
