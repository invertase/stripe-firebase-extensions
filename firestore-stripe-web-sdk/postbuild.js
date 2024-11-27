import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const pkg = JSON.parse(readFileSync('./package.json'));
const files = readdirSync('./lib').filter(file => file.endsWith('.js'));

files.forEach(file => {
  const filepath = join('./lib', file);
  const content = readFileSync(filepath, 'utf8');

  if (content.includes('__VERSION__')) {
    const newContent = content.replace(/__VERSION__/g, pkg.version);
    writeFileSync(filepath, newContent);
    console.log(`Replaced version in: ${filepath}`);
  }
});