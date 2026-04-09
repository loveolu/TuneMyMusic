import { buildApp } from './app.js';
import { config } from './config.js';

async function main() {
  const app = await buildApp();
  await app.listen({ port: config.port, host: config.host });
  console.log(`Server running on http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
