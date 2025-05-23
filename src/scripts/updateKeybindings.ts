// scripts/updateKeybindings.ts

import fs from 'fs';
import path from 'path';

const shortcutsPath = path.join(__dirname, '..', '..', 'out', 'shortcuts.json');
const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');

const shortcuts = JSON.parse(fs.readFileSync(shortcutsPath, 'utf8'));
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Nettoie les keybindings actuels liés à echocode
pkg.contributes.keybindings = pkg.contributes.keybindings?.filter((k: any) => !k.command.startsWith('echocode.print')) || [];

// Ajoute chaque nouveau raccourci
for (const s of shortcuts) {
  const normalized = s.shortcut
    .replace(/\+/g, '')
    .replace(/\s/g, '')
    .replace(/-/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');
  
  const commandId = `echocode.print${normalized}`;

  pkg.contributes.keybindings.push({
    key: s.shortcut.toLowerCase(),
    command: commandId,
  });
}

fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
console.log('✅ Keybindings updated!');
