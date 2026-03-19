import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'xwar-dev-secret'

export interface AuthPayload {
  playerId: string
  playerName: string
}

export interface AuthRequest extends Request {
  player?: AuthPayload
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload
}

/**
 * Middleware: requires valid JWT in Authorization header.
 * Sets `req.player` with { playerId, playerName }.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' })
    return
  }

  try {
    const token = header.slice(7)
    const payload = verifyToken(token)
    req.player = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
