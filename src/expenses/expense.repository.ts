import { prisma } from '../common/prisma';
import { ParticipantShare, SharedExpense, SplitType } from './expense.model';

/** Shape of a Prisma sharedExpense row with participants included. */
interface ExpenseRow {
    id: string;
    creatorId: string;
    description: string;
    totalCents: number;
    splitType: string;
    createdAt: Date;
    participants: { userId: string; shareCents: number }[];
}

/** Fully-resolved data required to persist a shared expense (shares computed). */
export interface PersistExpenseInput {
    creatorId: string;
    description: string;
    totalCents: number;
    splitType: SplitType;
    participants: ParticipantShare[];
}

/**
 * Repository for shared expenses — the only layer touching Prisma here.
 */
export class ExpenseRepository {
    /**
     * Persist a shared expense together with its participant shares in one transaction.
     * @param input expense data with pre-computed shares
     */
    async create(input: PersistExpenseInput): Promise<SharedExpense> {
        const created = await prisma.sharedExpense.create({
            data: {
                creatorId: input.creatorId,
                description: input.description,
                totalCents: input.totalCents,
                splitType: input.splitType,
                participants: {
                    create: input.participants.map((p) => ({
                        userId: p.userId,
                        shareCents: p.shareCents,
                    })),
                },
            },
            include: { participants: true },
        });
        return this.map(created);
    }

    /**
     * Return every shared expense in which the given user participates.
     * @param userId participant to filter by
     */
    async findExpensesForParticipant(userId: string): Promise<SharedExpense[]> {
        const rows = await prisma.sharedExpense.findMany({
            where: { participants: { some: { userId } } },
            include: { participants: true },
        });
        return rows.map((r: ExpenseRow) => this.map(r));
    }

    /** Map a Prisma row to the domain SharedExpense type. */
    private map(row: ExpenseRow): SharedExpense {
        return {
            id: row.id,
            creatorId: row.creatorId,
            description: row.description,
            totalCents: row.totalCents,
            splitType: row.splitType as SplitType,
            createdAt: row.createdAt,
            participants: row.participants.map((p) => ({
                userId: p.userId,
                shareCents: p.shareCents,
            })),
        };
    }
}
