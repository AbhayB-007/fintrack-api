import { Request, Response, NextFunction } from 'express';
import { AppError } from './errors';
import { logger } from './logger';

/**
 * Express request augmented with the authenticated principal.
 */
export interface AuthedRequest extends Request {
    userId?: string;
}

/**
 * Minimal authentication middleware for the assessment.
 * In production this would verify a JWT / session. Here we read a trusted
 * `x-user-id` header set by the API gateway. Requests without it are rejected.
 *
 * @throws responds 401 if no principal can be established.
 */
export function authenticate(req: AuthedRequest, res: Response, next: NextFunction): void {
    const userId = req.header('x-user-id');
    if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    req.userId = userId;
    next();
}

/**
 * Central error-handling middleware. Maps typed AppErrors to their status code
 * and returns a generic message for unknown errors (no stack leakage).
 */
export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
    }
    logger.error('Unhandled error', { error: (err as Error)?.message });
    res.status(500).json({ error: 'Internal server error' });
}

/** Dollars (float from API boundary) -> integer cents. */
export function toCents(dollars: number): number {
    return Math.round(dollars * 100);
}

/** Integer cents -> dollars (number) for API responses. */
export function toDollars(cents: number): number {
    return cents / 100;
}
