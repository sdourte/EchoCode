import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const SHORTCUTS_FILE = path.join(__dirname, '..', '..', 'out', 'shortcuts.json');

export interface SoundShortcut {
	shortcut: string;
	soundFile: string;
	enabled: boolean;
	volume: number; // 0 to 1
}

type SoundShortcutData = SoundShortcut;

// 🔹 Item pour les raccourcis (inchangé)
export class SoundTreeItem extends vscode.TreeItem {
	constructor(
		public readonly shortcut: string,
		public readonly soundFile: string,
		public readonly enabled: boolean,
		public readonly volume: number,
		public readonly isVolumeControl?: 'increase' | 'decrease'
	) {
		super(
			isVolumeControl === 'increase'
				? 'Augmenter le volume'
				: isVolumeControl === 'decrease'
				? 'Diminuer le volume'
				: shortcut,
			isVolumeControl ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
		);

		if (!isVolumeControl) {
			this.tooltip = `Son: ${soundFile}\nÉtat: ${enabled ? 'Activé' : 'Désactivé'}\nVolume: ${Math.round(volume * 100)}%`;
			this.description = `${soundFile} • ${enabled ? '🔊' : '🔇'} • ${Math.round(volume * 100)}%`;
			this.contextValue = 'soundItem';
			this.iconPath = new vscode.ThemeIcon(enabled ? 'unmute' : 'mute');
			this.command = {
				command: 'echocode.playShortcutSound',
				title: 'Play',
				arguments: [this]
			};
		} else {
			this.contextValue = 'volumeControl';
			this.iconPath = new vscode.ThemeIcon(isVolumeControl === 'increase' ? 'add' : 'remove');
			this.command = {
				command: isVolumeControl === 'increase' ? 'echocode.increaseVolume' : 'echocode.decreaseVolume',
				title: this.label as string,
				arguments: [this]
			};
		}
	}
}

// 🔹 Item spécial pour "Ajouter un raccourci"
export class AddShortcutTreeItem extends vscode.TreeItem {
	constructor() {
		super('➕ Ajouter un raccourci', vscode.TreeItemCollapsibleState.None);
		this.command = {
			command: 'echocode.addShortcut',
			title: 'Ajouter un raccourci'
		};
		this.contextValue = 'addShortcut';
	}
}

export class SoundTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;

	private shortcuts: SoundShortcut[] = [];

	constructor() {
		this.loadShortcuts();
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
		if (!element) {
			const items: vscode.TreeItem[] = [];

			// Ajouter le bouton "Ajouter un raccourci"
			items.push(new AddShortcutTreeItem());

			// Ajouter les raccourcis existants
			for (const data of this.shortcuts) {
				items.push(new SoundTreeItem(data.shortcut, data.soundFile, data.enabled, data.volume));
			}

			return items;
		}

		if (element instanceof SoundTreeItem && !element.isVolumeControl) {
			return [
				new SoundTreeItem(element.shortcut, element.soundFile, element.enabled, element.volume, 'increase'),
				new SoundTreeItem(element.shortcut, element.soundFile, element.enabled, element.volume, 'decrease')
			];
		}

		return [];
	}

	toggleShortcut(shortcut: string) {
		const item = this.shortcuts.find(s => s.shortcut === shortcut);
		if (item) {
			item.enabled = !item.enabled;
			this.saveShortcuts();
			this.refresh();
		}
	}

	updateVolume(shortcut: string, newVolume: number) {
		const item = this.shortcuts.find(s => s.shortcut === shortcut);
		if (item) {
			item.volume = Math.max(0, Math.min(1, newVolume));
			this.saveShortcuts();
			this.refresh();
		}
	}

	updateSoundFile(shortcut: string, newFile: string) {
		const item = this.shortcuts.find(s => s.shortcut === shortcut);
		if (item) {
			item.soundFile = newFile;
			this.saveShortcuts();
			this.refresh();
			vscode.window.showInformationMessage(`✅ Son mis à jour pour le raccourci "${shortcut}" : ${newFile}`);
		}
	}

	addShortcut(data: SoundShortcutData) {
		this.shortcuts.push(data);
		this.saveShortcuts();
		this._onDidChangeTreeData.fire();
	}

	removeShortcut(shortcut: string) {
		this.shortcuts = this.shortcuts.filter(s => s.shortcut !== shortcut);
		this.saveShortcuts();
		this.refresh();
	}

	getShortcut(shortcut: string): SoundShortcut | undefined {
		return this.shortcuts.find(s => s.shortcut === shortcut);
	}

	getAllShortcuts(): SoundShortcut[] {
		return this.shortcuts;
	}

	private loadShortcuts() {
		if (fs.existsSync(SHORTCUTS_FILE)) {
			try {
				const data = fs.readFileSync(SHORTCUTS_FILE, 'utf-8');
				this.shortcuts = JSON.parse(data);
			} catch (error) {
				console.error('Erreur lors du chargement des raccourcis :', error);
				this.shortcuts = [];
			}
		}
	}

	private saveShortcuts() {
		try {
			fs.writeFileSync(SHORTCUTS_FILE, JSON.stringify(this.shortcuts, null, 2));
		} catch (error) {
			console.error('Erreur lors de la sauvegarde des raccourcis :', error);
		}
	}
}
