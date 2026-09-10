import { cp, mkdir } from 'node:fs/promises';
await mkdir('dist/client/modules', { recursive: true });
await cp('web', 'dist/client', { recursive: true });
for (const name of ['ui', 'engine', 'data', 'domain.js', 'events.js']) {
  await cp(`dist/${name}`, `dist/client/modules/${name}`, { recursive: true });
}
