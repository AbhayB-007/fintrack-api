import { Router, Response, NextFunction } from 'express';
import { AuthedRequest, toCents, toDollars } from '../common/http';
import { TransactionService } from './transaction.service';

/**
 * Builds the Express router for transaction endpoints.
 * The controller layer only parses input and maps results to HTTP — no business logic.
 */
export function createTransactionRouter(service = new TransactionService()): Router {
    const router = Router();

    /** POST /transactions — create a transaction for the authenticated user. */
    router.post('/', async (req: AuthedRequest, res: Response, next: NextFunction) => {
        try {
            const { description, amount, type } = req.body ?? {};
            const tx = await service.create(req.userId!, {
                description,
                amountCents: toCents(Number(amount)),
                type,
            });
            res.status(201).json({ ...tx, amount: toDollars(tx.amountCents) });
        } catch (err) {
            next(err);
        }
    });

    /** GET /transactions — list the authenticated user's transactions. */
    router.get('/', async (req: AuthedRequest, res: Response, next: NextFunction) => {
        try {
            const txs = await service.getByUser(req.userId!);
            res.json(txs.map((t) => ({ ...t, amount: toDollars(t.amountCents) })));
        } catch (err) {
            next(err);
        }
    });

    /** DELETE /transactions — delete all of the authenticated user's transactions. */
    router.delete('/', async (req: AuthedRequest, res: Response, next: NextFunction) => {
        try {
            const count = await service.deleteAllForUser(req.userId!);
            res.json({ deleted: count });
        } catch (err) {
            next(err);
        }
    });

    return router;
}
