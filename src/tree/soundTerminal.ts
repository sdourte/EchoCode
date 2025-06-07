import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const RUN_SOUNDS_FILE = path.join(__dirname, '..', '..', 'out', 'runSounds.json');

export type RunSoundType = 'success' | 'error';

export interface RunSound {
	type: RunSoundType;
	soundFile: string;
	enabled: boolean;
	volume: number; // 0 to 1
}

export class RunSoundTreeItem2 extends vscode.TreeItem {
	constructor(
		public readonly type: RunSoundType,
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
				: `Son ${type === 'success' ? '✔️ Succès' : '❌ Erreur'}`,
			isVolumeControl ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
		);

		if (!isVolumeControl) {
			this.tooltip = `Son: ${soundFile}\nÉtat: ${enabled ? 'Activé' : 'Désactivé'}\nVolume: ${Math.round(volume * 100)}%`;
			this.description = `${soundFile} • ${enabled ? '🔊' : '🔇'} • ${Math.round(volume * 100)}%`;
			this.contextValue = 'runSoundItem';
			this.iconPath = new vscode.ThemeIcon(enabled ? 'unmute' : 'mute');

			this.command = {
				command: 'echocode.playRunSound',
				title: 'Play',
				arguments: [this]
			};
		} else {
			this.contextValue = 'volumeControl';
			this.iconPath = new vscode.ThemeIcon(isVolumeControl === 'increase' ? 'add' : 'remove');
			this.command = {
				command: isVolumeControl === 'increase' ? 'echocode.increaseRunVolume' : 'echocode.decreaseRunVolume',
				title: this.label as string,
				arguments: [this]
			};
		}
	}
}

export class RunSoundTreeDataProvider2 implements vscode.TreeDataProvider<RunSoundTreeItem2> {
	private _onDidChangeTreeData: vscode.EventEmitter<RunSoundTreeItem2 | undefined | void> = new vscode.EventEmitter();
	readonly onDidChangeTreeData: vscode.Event<RunSoundTreeItem2 | undefined | void> = this._onDidChangeTreeData.event;

	private runSounds: RunSound[] = [];

	constructor() {
		this.loadSounds();
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: RunSoundTreeItem2): vscode.TreeItem {
		return element;
	}

	getChildren(element?: RunSoundTreeItem2): vscode.ProviderResult<RunSoundTreeItem2[]> {
		if (!element) {
			return this.runSounds.map(
				s => new RunSoundTreeItem2(s.type, s.soundFile, s.enabled, s.volume)
			);
		}

		if (!element.isVolumeControl) {
			return [
				new RunSoundTreeItem2(element.type, element.soundFile, element.enabled, element.volume, 'increase'),
				new RunSoundTreeItem2(element.type, element.soundFile, element.enabled, element.volume, 'decrease')
			];
		}

		return [];
	}

	toggle(type: RunSoundType) {
		const item = this.runSounds.find(s => s.type === type);
		if (item) {
			item.enabled = !item.enabled;
			this.saveSounds();
			this.refresh();
		}
	}

	updateVolume(type: RunSoundType, newVolume: number) {
		const item = this.runSounds.find(s => s.type === type);
		if (item) {
			item.volume = Math.max(0, Math.min(1, newVolume));
			this.saveSounds();
			this.refresh();
		}
	}

	updateSoundFile(type: RunSoundType, newFile: string) {
		const item = this.runSounds.find(s => s.type === type);
		if (item) {
			item.soundFile = newFile;
			this.saveSounds();
			this.refresh();
			vscode.window.showInformationMessage(`✅ Son mis à jour pour "${type}" : ${newFile}`);
		}
	}

	getAll(): RunSound[] {
		return this.runSounds;
	}

	private loadSounds() {
		if (fs.existsSync(RUN_SOUNDS_FILE)) {
			try {
				const data = fs.readFileSync(RUN_SOUNDS_FILE, 'utf-8');
				this.runSounds = JSON.parse(data);
			} catch (error) {
				console.error('Erreur lors du chargement des sons post-run :', error);
				this.runSounds = [];
			}
		} else {
			// valeurs par défaut
			this.runSounds = [
				{ type: 'success', soundFile: 'success.mp3', enabled: true, volume: 0.8 },
				{ type: 'error', soundFile: 'error.mp3', enabled: true, volume: 0.8 }
			];
			this.saveSounds();
		}
	}

	private saveSounds() {
		try {
			fs.writeFileSync(RUN_SOUNDS_FILE, JSON.stringify(this.runSounds, null, 2));
		} catch (error) {
			console.error('Erreur lors de la sauvegarde des sons post-run :', error);
		}
	}
}
