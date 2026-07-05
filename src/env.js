// .env を読み込む極小ローダー（依存なし）。index.js の最初にimportすること。
// 既に設定済みの環境変数は上書きしない（CIのSecrets優先）。
import { readFileSync } from 'node:fs';

try {
  const text = readFileSync('.env', 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  /* .env が無ければ何もしない */
}
