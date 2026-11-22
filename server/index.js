// Custom server: Express + Socket.io, Vite middleware mode khi dev.
import http from 'node:http';
import path from 'node:path';
import { config } from './config.js';
import { createApp } from './app.js';
import { createIo } from './sockets.js';

const isDev = process.env.NODE_ENV !== 'production';

async function main() {
  let appOptions;
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: path.resolve(process.cwd(), 'client'),
      server: { middlewareMode: true },
      appType: 'custom',
    });
    appOptions = { vite };
  } else {
    appOptions = { distDir: path.resolve(process.cwd(), 'dist') };
  }

  const app = createApp(appOptions);
  const server = http.createServer(app);
  createIo(server);

  server.listen(config.port, () => {
    console.log(`[server] chạy ở http://localhost:${config.port} (${isDev ? 'dev: Vite middleware' : 'prod: static dist'})`);
  });
}

main();
