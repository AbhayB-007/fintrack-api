import { createApp } from './app';
import { logger } from './common/logger';

const PORT = Number(process.env.PORT ?? 3000);

createApp().listen(PORT, () => {
    logger.info('server.started', { port: PORT });
});
