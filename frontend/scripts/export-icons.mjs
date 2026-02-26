import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const iconsDir = path.join(rootDir, 'public', 'icons');
const sourceSvg = path.join(iconsDir, 'icon-512.svg');

const targets = [
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-180.png', size: 180 },
  { file: 'favicon-32.png', size: 32 },
  { file: 'favicon-16.png', size: 16 }
];

for (const target of targets) {
  const outputPath = path.join(iconsDir, target.file);
  await sharp(sourceSvg).resize(target.size, target.size).png().toFile(outputPath);
  console.log(`Generated ${outputPath}`);
}
