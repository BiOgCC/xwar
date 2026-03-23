/**
 * Central application error class.
 * All route errors should throw or return this for consistent JSON shape:
 *   { error: string, code: string }
 */
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError
}
