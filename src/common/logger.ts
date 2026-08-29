import { createLogger, format, transports } from 'winston';

/**
 * Central structured (JSON) logger. Never use console.log in app code.
 * Secrets and full PII must never be logged.
 */
export const logger = createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    format: format.combine(format.timestamp(), format.json()),
    transports: [new transports.Console()],
});
