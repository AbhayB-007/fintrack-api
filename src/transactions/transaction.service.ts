import { z } from 'zod';
import { AuthorizationError, NotFoundError, ValidationError } from '../common/errors';
import { logger } from '../common/logger';
import { Transaction, TransactionType } from './transaction.model';
import { TransactionRepository } from './transaction.repository';

/** Zod schema validating create-transaction input (amounts in cents). */
const createSchema = z.object({
    description: z.string().min(1).max(255),
    amountCents: z.number().int().positive(),
    type: z.enum(['debit', 'credit']),
});

/** Shape accepted by the service create method. */
export interface CreateTransactionRequest {
    description: string;
    amountCents: number;
    type: TransactionType;
}

/**
 * Transaction business logic. Enforces validation and authorization.
 * Never touches Prisma directly and never reads req/res.
 */
export class TransactionService {
    constructor(private readonly repo: TransactionRepository = new TransactionRepository()) { }

    /**
     * Create a transaction for the authenticated user.
     * @param userId authenticated principal (owner)
     * @param input transaction fields
     * @throws ValidationError when input is invalid
     */
    async create(userId: string, input: CreateTransactionRequest): Promise<Transaction> {
        const parsed = createSchema.safeParse(input);
        if (!parsed.success) {
            throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
        }
        const tx = await this.repo.create({ userId, ...parsed.data });
        logger.info('transaction.created', { userId, transactionId: tx.id });
        return tx;
    }

    /**
     * List all transactions owned by the authenticated user.
     * @param userId authenticated principal
     */
    async getByUser(userId: string): Promise<Transaction[]> {
        return this.repo.findByUser(userId);
    }

    /**
     * Fetch one transaction, enforcing ownership.
     * @throws NotFoundError if it does not exist
     * @throws AuthorizationError if it belongs to another user
     */
    async getOwned(userId: string, transactionId: string): Promise<Transaction> {
        const tx = await this.repo.findById(transactionId);
        if (!tx) throw new NotFoundError('Transaction not found');
        if (tx.userId !== userId) throw new AuthorizationError();
        return tx;
    }

    /**
     * Delete all of the authenticated user's transactions (scoped to them only).
     * @param userId authenticated principal
     * @returns number of transactions deleted
     */
    async deleteAllForUser(userId: string): Promise<number> {
        const count = await this.repo.deleteAllForUser(userId);
        logger.info('transaction.deleteAll', { userId, count });
        return count;
    }
}
