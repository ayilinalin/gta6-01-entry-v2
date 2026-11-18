// NEON TIDE v2 — entry builder (Node 22, standard library only).
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json with buildDossier from vendor/makefun-game.ts.
// Run twice: both runs must write byte-identical output.
//   MAKEFUN_OUTPUT_DIR=out node main.ts
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

// Gate caps for this bounty: dossier at most 1.5 MiB, at most 4 screenshots
// of 256 KiB each, game/ at most 993 entries / 48 MiB, paths at most 1000 bytes.
const CAPS = {
  text_max_bytes: 1572864,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(name) {
  const src = join(repoRoot, name);
  if (!existsSync(src)) throw new Error(`main.ts: missing ${name}/ in ${repoRoot}`);
  cpSync(src, join(outDir, name), { recursive: true });
}

// Clear the output directory's CONTENTS only — never the directory itself.
// The grader mounts /output as a volume; removing a mount point dies with
// EBUSY (-4094) and the run exits 1 before it writes anything.
mkdirSync(outDir, { recursive: true });
for (const entry of readdirSync(outDir)) {
  rmSync(join(outDir, entry), { recursive: true, force: true });
}
copyTree('game');
copyTree('screenshots');

const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`wrote ${outDir}/dossier.json (${dossier.length} bytes)`);
