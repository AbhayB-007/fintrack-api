import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';

/**
 * Express router for user endpoints. These are intentionally unauthenticated
 * so an operator can bootstrap users before making authenticated calls.
 */
export function createUserRouter(service = new UserService()): Router {
    const router = Router();

    /**
     * POST /users — create a new user.
     * Body: { id?, name }
     */
    router.post('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id, name } = req.body ?? {};
            const user = await service.create({ id, name });
            res.status(201).json(user);
        } catch (err) {
            next(err);
        }
    });

    /**
     * GET /users — list all users and the total count in the database.
     */
    router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.list();
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    return router;
}
