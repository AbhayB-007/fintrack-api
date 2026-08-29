/**
 * Typed application error classes.
 * Services throw these; the Express error middleware maps them to HTTP status codes.
 */

/** Base class for all known/handled application errors. */
export class AppError extends Error {
    public readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = new.target.name;
        this.statusCode = statusCode;
        Error.captureStackTrace?.(this, new.target);
    }
}

/** 400 — invalid or malformed input. */
export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 400);
    }
}

/** 403 — authenticated but not allowed to access the resource. */
export class AuthorizationError extends AppError {
    constructor(message = 'You are not authorized to access this resource') {
        super(message, 403);
    }
}

/** 404 — resource does not exist. */
export class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}
