import { z } from 'zod';
import { prisma } from '../common/prisma';
import { ValidationError } from '../common/errors';
import { logger } from '../common/logger';

/** A user as returned by the API. */
export interface User {
    id: string;
    name: string;
    createdAt: Date;
}

/** Zod schema for creating a user. `id` is optional; generated if omitted. */
const createUserSchema = z.object({
    id: z.string().min(1).max(64).optional(),
    name: z.string().min(1).max(120),
});

/** Shape accepted by the service create method. */
export interface CreateUserRequest {
    id?: string;
    name: string;
}

/**
 * User management logic. Kept intentionally small: create and list.
 * Repository access is via Prisma; validation via Zod.
 */
export class UserService {
    /**
     * Create a new user.
     * @param input user id (optional) and display name
     * @throws ValidationError when input is invalid or the id already exists
     */
    async create(input: CreateUserRequest): Promise<User> {
        const parsed = createUserSchema.safeParse(input);
        if (!parsed.success) {
            throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
        }

        if (parsed.data.id) {
            const existing = await prisma.user.findUnique({ where: { id: parsed.data.id } });
            if (existing) {
                throw new ValidationError(`User with id '${parsed.data.id}' already exists`);
            }
        }

        const user = (await prisma.user.create({
            data: { id: parsed.data.id, name: parsed.data.name },
        })) as User;
        logger.info('user.created', { userId: user.id });
        return user;
    }

    /**
     * List all users along with a total count.
     * @returns users and how many exist in the database
     */
    async list(): Promise<{ count: number; users: User[] }> {
        const users = (await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })) as User[];
        return { count: users.length, users };
    }
}
