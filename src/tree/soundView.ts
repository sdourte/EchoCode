import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const SHORTCUTS_FILE = path.join(__dirname, '..', '..', 'out', 'shortcuts.json');

export interface SlotConfig {
	soundFile: string;
	enabled: boolean;
	volume: number;
}

type SlotMap = Record<string, SlotConfig>;

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
			this.description = `${enabled ? '🔊' : '🔇'} • ${Math.round(volume * 100)}%`;
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

	private slotMap: SlotMap = {};

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

			// ➕ Ajouter le bouton d'ajout
			items.push(new AddShortcutTreeItem());

			// Afficher les 5 slots
			const orderedSlots = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5'];
			for (const slot of orderedSlots) {
				const data = this.slotMap[slot];
				if (data) {
					items.push(new SoundTreeItem(slot, data.soundFile, data.enabled, data.volume));
				}
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

	toggleShortcut(slotId: string) {
		const config = this.slotMap[slotId];
		if (config) {
			config.enabled = !config.enabled;
			this.saveSlots();
			this.refresh();
		}
	}

	updateVolume(slotId: string, newVolume: number) {
		const config = this.slotMap[slotId];
		if (config) {
			config.volume = Math.max(0, Math.min(1, newVolume));
			this.saveSlots();
			this.refresh();
		}
	}

	updateSoundFile(slotId: string, newFile: string) {
		const config = this.slotMap[slotId];
		if (config) {
			config.soundFile = newFile;
			this.saveSlots();
			this.refresh();
			vscode.window.showInformationMessage(`✅ Son mis à jour pour le raccourci "${slotId}" : ${newFile}`);
		}
	}

	updateSlot(slotId: string, config: SlotConfig) {
		this.slotMap[slotId] = config;
		this.saveSlots();
		this.refresh();
	}

	getSlotConfig(slotId: string): SlotConfig | undefined {
		return this.slotMap[slotId];
	}

	private loadShortcuts() {
		if (fs.existsSync(SHORTCUTS_FILE)) {
			try {
				const data = fs.readFileSync(SHORTCUTS_FILE, 'utf-8');
				this.slotMap = JSON.parse(data);
			} catch (error) {
				console.error('Erreur lors du chargement des raccourcis :', error);
				this.slotMap = {};
			}
		}
	}

	private saveSlots() {
		try {
			fs.writeFileSync(SHORTCUTS_FILE, JSON.stringify(this.slotMap, null, 2));
		} catch (error) {
			console.error('Erreur lors de la sauvegarde des slots :', error);
		}
	}
}
