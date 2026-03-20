/**
 * Rate limiting middleware
 * Prevents abuse on mutation endpoints
 */
import rateLimit from 'express-rate-limit'

/** General API rate limit — 100 requests per minute */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
})

/** Auth rate limit — 10 attempts per minute (login/register) */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many auth attempts. Try again in a minute.' },
})

/** Combat rate limit — 30 actions per 15 seconds */
export const combatLimiter = rateLimit({
  windowMs: 15 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Combat action rate limited.' },
})

/** Casino rate limit — 20 actions per 10 seconds */
export const casinoLimiter = rateLimit({
  windowMs: 10 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Casino action rate limited.' },
})

/** Market rate limit — 15 actions per 10 seconds */
export const marketLimiter = rateLimit({
  windowMs: 10 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Market action rate limited.' },
})
