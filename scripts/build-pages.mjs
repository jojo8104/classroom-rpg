import { cp, mkdir, writeFile } from 'node:fs/promises';

// GitHub Pages sert le dossier /docs de master. Seuls les fichiers du jeu y vont.
await mkdir('docs', { recursive: true });
await cp('dist/client', 'docs', { recursive: true });
await writeFile('docs/.nojekyll', '');
