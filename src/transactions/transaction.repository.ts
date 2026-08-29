import { prisma } from '../common/prisma';
import { CreateTransactionInput, Transaction } from './transaction.model';

/**
 * Repository — the ONLY layer allowed to touch Prisma for transactions.
 * Uses parameterized ORM calls (no raw SQL, no string concatenation).
 */
export class TransactionRepository {
    /**
     * Persist a new transaction.
     * @param input validated, authorized creation data
     * @returns the created transaction
     */
    async create(input: CreateTransactionInput): Promise<Transaction> {
        return prisma.transaction.create({ data: input }) as unknown as Promise<Transaction>;
    }

    /**
     * Fetch a single transaction by id.
     * @returns the transaction or null if not found
     */
    async findById(id: string): Promise<Transaction | null> {
        return prisma.transaction.findUnique({ where: { id } }) as unknown as Promise<Transaction | null>;
    }

    /**
     * List all transactions belonging to a specific user, newest first.
     * @param userId owner of the transactions
     */
    async findByUser(userId: string): Promise<Transaction[]> {
        return prisma.transaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        }) as unknown as Promise<Transaction[]>;
    }

    /**
     * Delete all transactions owned by a specific user (scoped, never global).
     * @param userId owner whose transactions are deleted
     * @returns number of rows deleted
     */
    async deleteAllForUser(userId: string): Promise<number> {
        const result = await prisma.transaction.deleteMany({ where: { userId } });
        return result.count;
    }
}
