import { Router, Response, NextFunction } from 'express';
import { AuthedRequest, toCents, toDollars } from '../common/http';
import { ExpenseService } from './expense.service';
import { ParticipantInput } from './expense.model';

/**
 * Express router for expense-splitting endpoints. Controller layer only maps
 * HTTP <-> service calls; no business logic here.
 */
export function createExpenseRouter(service = new ExpenseService()): Router {
    const router = Router();

    /**
     * POST /expenses — create a shared expense with participants.
     * Body: { description, totalAmount, splitType, participants: [{ userId, shareAmount? }] }
     * Amounts are in dollars and converted to cents at this boundary.
     */
    router.post('/', async (req: AuthedRequest, res: Response, next: NextFunction) => {
        try {
            const { description, totalAmount, splitType, participants } = req.body ?? {};
            const mapped: ParticipantInput[] = Array.isArray(participants)
                ? participants.map((p: { userId: string; shareAmount?: number }) => ({
                    userId: p.userId,
                    shareCents: p.shareAmount === undefined ? undefined : toCents(Number(p.shareAmount)),
                }))
                : [];

            const expense = await service.createSharedExpense(req.userId!, {
                description,
                totalCents: toCents(Number(totalAmount)),
                splitType,
                participants: mapped,
            });

            res.status(201).json({
                ...expense,
                totalAmount: toDollars(expense.totalCents),
                participants: expense.participants.map((p) => ({
                    userId: p.userId,
                    shareAmount: toDollars(p.shareCents),
                })),
            });
        } catch (err) {
            next(err);
        }
    });

    /**
     * GET /expenses — list all shared expenses the authenticated user is
     * involved in (as creator or participant).
     */
    router.get('/', async (req: AuthedRequest, res: Response, next: NextFunction) => {
        try {
            const expenses = await service.getExpensesForUser(req.userId!);
            res.json(
                expenses.map((expense) => ({
                    id: expense.id,
                    creatorId: expense.creatorId,
                    description: expense.description,
                    splitType: expense.splitType,
                    createdAt: expense.createdAt,
                    totalAmount: toDollars(expense.totalCents),
                    participants: expense.participants.map((p) => ({
                        userId: p.userId,
                        shareAmount: toDollars(p.shareCents),
                    })),
                })),
            );
        } catch (err) {
            next(err);
        }
    });

    /**
     * GET /expenses/balances — pending balances for the authenticated user:
     * who they owe, who owes them, net per person.
     */
    router.get('/balances', async (req: AuthedRequest, res: Response, next: NextFunction) => {
        try {
            const summary = await service.getBalances(req.userId!);
            res.json({
                userId: summary.userId,
                owedToUser: summary.owedToUser.map((b) => ({
                    counterpartyId: b.counterpartyId,
                    amount: toDollars(b.netCents),
                    
                })),
                userOwes: summary.userOwes.map((b) => ({
                    counterpartyId: b.counterpartyId,
                    amount: toDollars(Math.abs(b.netCents)),
                })),
            });
        } catch (err) {
            next(err);
        }
    });

    return router;
}
