import { GlobalKeyboardListener } from 'node-global-key-listener';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

interface ShortcutEntry {
	shortcut: string;
	soundFile: string;
	enabled: boolean;
	volume: number;
}

const SHORTCUTS_FILE = path.join(__dirname, '..', 'data', 'shortcuts.json');
let shortcuts: ShortcutEntry[] = [];

function loadShortcuts(): void {
	try {
		const raw = fs.readFileSync(SHORTCUTS_FILE, 'utf-8');
		const parsed: ShortcutEntry[] = JSON.parse(raw);
		shortcuts = parsed.filter(entry => entry.enabled);
		console.log('[KeyListener] Shortcuts loaded:', shortcuts);
	} catch (err) {
		console.error('[KeyListener] Failed to load shortcuts:', err);
	}
}

function playSound(filePath: string, volume: number = 1): void {
	const resolvedPath = path.resolve(__dirname, '..', '..', 'media', filePath);
	exec(`start "" "${resolvedPath}"`, (err) => {
		if (err) {
			console.error('[KeyListener] Error playing sound:', err);
		}
	});
}

function getComboString(e: any): string {
	const mods: string[] = [];
	if (e.ctrlKey) {mods.push('Ctrl');}
	if (e.altKey) {mods.push('Alt');}
	if (e.shiftKey) {mods.push('Shift');}
	if (e.metaKey) {mods.push('Meta');}
	mods.push(e.name); // ex: "C", "V", "Enter", etc.
	return mods.join('+');
}

const gkl = new GlobalKeyboardListener();

gkl.addListener((e: any) => {
	if (e.state === 'DOWN') {
		const combo = getComboString(e);
		const match = shortcuts.find(sc => sc.shortcut === combo);
		if (match) {
			playSound(match.soundFile, match.volume);
			console.log('KEY:' + combo);
		}
	}
});

fs.watch(SHORTCUTS_FILE, () => {
	console.log('[KeyListener] Shortcuts file changed, reloading...');
	loadShortcuts();
});

loadShortcuts();
