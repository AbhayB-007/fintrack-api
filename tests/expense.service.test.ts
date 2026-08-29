import { ExpenseService } from '../src/expenses/expense.service';
import { ExpenseRepository } from '../src/expenses/expense.repository';
import { SharedExpense } from '../src/expenses/expense.model';
import { AuthorizationError, ValidationError } from '../src/common/errors';

/**
 * Unit tests for the Expense Splitting feature.
 * The repository is fully mocked so tests are deterministic and DB-free.
 */

/** Build a mock repository whose `create` echoes back a persisted expense. */
function buildMockRepo(overrides: Partial<ExpenseRepository> = {}): ExpenseRepository {
    const repo = {
        create: jest.fn(async (input: any): Promise<SharedExpense> => ({
            id: 'exp-1',
            creatorId: input.creatorId,
            description: input.description,
            totalCents: input.totalCents,
            splitType: input.splitType,
            participants: input.participants,
            createdAt: new Date(),
        })),
        findExpensesForParticipant: jest.fn(async () => []),
        ...overrides,
    } as unknown as ExpenseRepository;
    return repo;
}

describe('ExpenseService.createSharedExpense', () => {
    it('1. splits equally among 3 participants (with remainder handling)', async () => {
        const repo = buildMockRepo();
        const service = new ExpenseService(repo);

        const expense = await service.createSharedExpense('alice', {
            description: 'Dinner',
            totalCents: 10000, // $100.00
            splitType: 'equal',
            participants: [{ userId: 'alice' }, { userId: 'bob' }, { userId: 'carol' }],
        });

        const shares = expense.participants.map((p) => p.shareCents);
        // 10000 / 3 = 3334, 3333, 3333 -> sums exactly to total, no lost cents
        expect(shares.reduce((a, b) => a + b, 0)).toBe(10000);
        expect(shares).toEqual([3334, 3333, 3333]);
    });

    it('2. accepts a custom split whose amounts match the total', async () => {
        const repo = buildMockRepo();
        const service = new ExpenseService(repo);

        const expense = await service.createSharedExpense('alice', {
            description: 'Trip',
            totalCents: 12000,
            splitType: 'custom',
            participants: [
                { userId: 'alice', shareCents: 5000 },
                { userId: 'bob', shareCents: 7000 },
            ],
        });

        expect(expense.participants.map((p) => p.shareCents)).toEqual([5000, 7000]);
    });

    it('3. rejects a custom split whose amounts do not sum to the total', async () => {
        const service = new ExpenseService(buildMockRepo());

        await expect(
            service.createSharedExpense('alice', {
                description: 'Rent',
                totalCents: 10000,
                splitType: 'custom',
                participants: [
                    { userId: 'alice', shareCents: 4000 },
                    { userId: 'bob', shareCents: 5000 }, // sums to 9000, not 10000
                ],
            }),
        ).rejects.toBeInstanceOf(ValidationError);
    });

    it('5. rejects an expense with only 1 participant (edge case)', async () => {
        const service = new ExpenseService(buildMockRepo());

        await expect(
            service.createSharedExpense('alice', {
                description: 'Solo',
                totalCents: 5000,
                splitType: 'equal',
                participants: [{ userId: 'alice' }],
            }),
        ).rejects.toBeInstanceOf(ValidationError);
    });
});

describe('ExpenseService.getBalances', () => {
    it('4. computes net balance between two users across multiple expenses', async () => {
        // Expense 1: Alice paid $30, Bob owes Alice $30.
        // Expense 2: Bob paid $10, Alice owes Bob $10.
        // Net: Bob owes Alice $20.
        const expenses: SharedExpense[] = [
            {
                id: 'e1',
                creatorId: 'alice',
                description: 'Lunch',
                totalCents: 3000,
                splitType: 'custom',
                createdAt: new Date(),
                participants: [
                    { userId: 'alice', shareCents: 0 },
                    { userId: 'bob', shareCents: 3000 },
                ],
            },
            {
                id: 'e2',
                creatorId: 'bob',
                description: 'Coffee',
                totalCents: 1000,
                splitType: 'custom',
                createdAt: new Date(),
                participants: [
                    { userId: 'bob', shareCents: 0 },
                    { userId: 'alice', shareCents: 1000 },
                ],
            },
        ];
        const repo = buildMockRepo({
            findExpensesForParticipant: jest.fn(async () => expenses),
        } as Partial<ExpenseRepository>);
        const service = new ExpenseService(repo);

        const summary = await service.getBalances('alice');

        expect(summary.owedToUser).toEqual([{ counterpartyId: 'bob', netCents: 2000 }]);
        expect(summary.userOwes).toEqual([]);
    });

    it('6. denies access when a user is not a participant (authorization)', () => {
        const service = new ExpenseService(buildMockRepo());
        const expense: SharedExpense = {
            id: 'e9',
            creatorId: 'alice',
            description: 'Private',
            totalCents: 5000,
            splitType: 'equal',
            createdAt: new Date(),
            participants: [
                { userId: 'alice', shareCents: 2500 },
                { userId: 'bob', shareCents: 2500 },
            ],
        };

        expect(() => service.assertParticipant(expense, 'mallory')).toThrow(AuthorizationError);
        expect(() => service.assertParticipant(expense, 'bob')).not.toThrow();
    });
});
