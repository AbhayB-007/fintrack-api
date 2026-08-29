import { z } from 'zod';
import { AuthorizationError, ValidationError } from '../common/errors';
import { logger } from '../common/logger';
import {
    BalanceSummary,
    CreateSharedExpenseInput,
    NetBalance,
    ParticipantShare,
    SharedExpense,
} from './expense.model';
import { ExpenseRepository } from './expense.repository';

/** Minimum participants required for a shared expense to be meaningful. */
const MIN_PARTICIPANTS = 2;

/** Zod schema for the create-expense request (amounts in cents). */
const createSchema = z.object({
    description: z.string().min(1).max(255),
    totalCents: z.number().int().positive(),
    splitType: z.enum(['equal', 'custom']),
    participants: z
        .array(
            z.object({
                userId: z.string().min(1),
                shareCents: z.number().int().nonnegative().optional(),
            }),
        )
        .min(MIN_PARTICIPANTS, `A shared expense needs at least ${MIN_PARTICIPANTS} participants`),
});

/**
 * Expense-splitting business logic: share calculation, validation, and
 * net-balance computation. Never touches Prisma directly, never reads req/res.
 */
export class ExpenseService {
    constructor(private readonly repo: ExpenseRepository = new ExpenseRepository()) { }

    /**
     * Create a shared expense, computing each participant's share.
     * @param creatorId authenticated principal creating the expense
     * @param input description, total, split type and participants
     * @throws ValidationError on invalid input, duplicate participants, or
     *         custom shares that do not sum to the total
     */
    async createSharedExpense(
        creatorId: string,
        input: Omit<CreateSharedExpenseInput, 'creatorId'>,
    ): Promise<SharedExpense> {
        const parsed = createSchema.safeParse(input);
        if (!parsed.success) {
            throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
        }
        const { description, totalCents, splitType, participants } = parsed.data;

        const userIds = participants.map((p) => p.userId);
        if (new Set(userIds).size !== userIds.length) {
            throw new ValidationError('Participants must be unique');
        }

        const shares =
            splitType === 'equal'
                ? this.computeEqualShares(userIds, totalCents)
                : this.validateCustomShares(participants, totalCents);

        const expense = await this.repo.create({
            creatorId,
            description,
            totalCents,
            splitType,
            participants: shares,
        });
        logger.info('expense.created', { creatorId, expenseId: expense.id, splitType });
        return expense;
    }

    /**
     * Split a total equally, distributing any remainder cents deterministically
     * so the shares always sum exactly to the total (no lost/created money).
     * @param userIds participant ids
     * @param totalCents total to split
     */
    private computeEqualShares(userIds: string[], totalCents: number): ParticipantShare[] {
        const base = Math.floor(totalCents / userIds.length);
        let remainder = totalCents - base * userIds.length;
        return userIds.map((userId) => {
            const extra = remainder > 0 ? 1 : 0;
            remainder -= extra;
            return { userId, shareCents: base + extra };
        });
    }

    /**
     * Validate custom shares: each must be provided and they must sum exactly
     * to the total.
     * @throws ValidationError if a share is missing or the sum mismatches
     */
    private validateCustomShares(
        participants: { userId: string; shareCents?: number }[],
        totalCents: number,
    ): ParticipantShare[] {
        const shares: ParticipantShare[] = participants.map((p) => {
            if (p.shareCents === undefined) {
                throw new ValidationError(`Custom split requires a share for user ${p.userId}`);
            }
            return { userId: p.userId, shareCents: p.shareCents };
        });
        const sum = shares.reduce((acc, s) => acc + s.shareCents, 0);
        if (sum !== totalCents) {
            throw new ValidationError(
                `Custom shares (${sum} cents) must sum to the total (${totalCents} cents)`,
            );
        }
        return shares;
    }

    /**
     * Compute pending net balances for a user across all shared expenses they
     * are involved in.
     *
     * Convention: the expense creator paid the bill, so every other participant
     * owes the creator their share. Balances between the same pair of users are
     * netted (A owes B $30, B owes A $10 => A owes B $20).
     *
     * @param userId authenticated principal requesting their balances
     * @returns who owes the user and who the user owes, net per person
     */
    async getBalances(userId: string): Promise<BalanceSummary> {
        const expenses = await this.repo.findExpensesForParticipant(userId);

        // netByCounterparty[X] > 0  => X owes `userId`
        // netByCounterparty[X] < 0  => `userId` owes X
        const netByCounterparty = new Map<string, number>();

        for (const expense of expenses) {
            const { creatorId } = expense;
            for (const share of expense.participants) {
                if (share.userId === creatorId) continue; // creator doesn't owe themselves

                if (creatorId === userId) {
                    // A participant owes the querying user (creator).
                    this.addToBalance(netByCounterparty, share.userId, share.shareCents);
                } else if (share.userId === userId) {
                    // The querying user owes the creator.
                    this.addToBalance(netByCounterparty, creatorId, -share.shareCents);
                }
            }
        }

        const owedToUser: NetBalance[] = [];
        const userOwes: NetBalance[] = [];
        for (const [counterpartyId, netCents] of netByCounterparty) {
            if (netCents > 0) owedToUser.push({ counterpartyId, netCents });
            else if (netCents < 0) userOwes.push({ counterpartyId, netCents });
        }

        return { userId, owedToUser, userOwes };
    }

    /** Accumulate a signed amount for a counterparty. */
    private addToBalance(map: Map<string, number>, counterpartyId: string, delta: number): void {
        map.set(counterpartyId, (map.get(counterpartyId) ?? 0) + delta);
    }

    /**
     * List all shared expenses the authenticated user is involved in
     * (as creator or participant).
     * @param userId authenticated principal
     */
    async getExpensesForUser(userId: string): Promise<SharedExpense[]> {
        return this.repo.findExpensesForParticipant(userId);
    }

    /**
     * Guard that a user is a participant of an expense before exposing it.
     * @throws AuthorizationError if the user is not involved
     */
    assertParticipant(expense: SharedExpense, userId: string): void {
        const involved =
            expense.creatorId === userId || expense.participants.some((p) => p.userId === userId);
        if (!involved) throw new AuthorizationError();
    }
}
