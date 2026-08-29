import express, { Express } from 'express';
import { authenticate, errorHandler } from './common/http';
import { createTransactionRouter } from './transactions/transaction.controller';
import { createExpenseRouter } from './expenses/expense.controller';
import { createUserRouter } from './users/user.controller';

/**
 * Build and configure the Express application.
 * All routes are protected by the authenticate middleware.
 */
export function createApp(): Express {
    const app = express();
    app.use(express.json());

    app.get('/health', (_req, res) => res.json({ status: 'ok' }));

    // User bootstrap endpoints are unauthenticated so operators can create users.
    app.use('/users', createUserRouter());
    app.use('/transactions', authenticate, createTransactionRouter());
    app.use('/expenses', authenticate, createExpenseRouter());

    app.use(errorHandler);
    return app;
}
