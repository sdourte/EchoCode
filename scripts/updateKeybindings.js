"use strict";
// scripts/updateKeybindings.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const shortcutsPath = path_1.default.join(__dirname, '..', 'out', 'shortcuts.json');
const packageJsonPath = path_1.default.join(__dirname, '..', 'package.json');
const shortcuts = JSON.parse(fs_1.default.readFileSync(shortcutsPath, 'utf8'));
const pkg = JSON.parse(fs_1.default.readFileSync(packageJsonPath, 'utf8'));
// Nettoie les keybindings actuels liés à echocode
pkg.contributes.keybindings = pkg.contributes.keybindings?.filter((k) => !k.command.startsWith('echocode.print')) || [];
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
fs_1.default.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
console.log('✅ Keybindings updated!');
//# sourceMappingURL=updateKeybindings.js.map