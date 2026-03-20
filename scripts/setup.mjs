import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const files = [
  ['apps/api/.env.example', 'apps/api/.env'],
  ['apps/web/.env.example', 'apps/web/.env.local'],
];

for (const [from, to] of files) {
  const target = resolve(process.cwd(), to);
  if (!existsSync(target)) {
    copyFileSync(resolve(process.cwd(), from), target);
  }
}
