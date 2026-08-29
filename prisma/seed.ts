import { PrismaClient } from '@prisma/client';

/**
 * Seed baseline users so expense-splitting endpoints work end-to-end.
 * Uses fixed ids that match the example curl requests.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
    const users = [
        { id: 'alice', name: 'Alice' },
        { id: 'bob', name: 'Bob' },
        { id: 'carol', name: 'Carol' },
    ];

    for (const user of users) {
        await prisma.user.upsert({
            where: { id: user.id },
            update: {},
            create: user,
        });
    }
    // eslint-disable-next-line no-console
    console.log('Seeded users:', users.map((u) => u.id).join(', '));
}

main()
    .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
