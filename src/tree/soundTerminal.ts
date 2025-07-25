import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const RUN_SOUNDS_FILE = path.join(__dirname, '..', 'data', 'runSounds.json');

export type RunSoundType = 'success' | 'error';

export interface RunSound {
	type: RunSoundType;
	soundFile: string;
	enabled: boolean;
	volume: number;
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
				: type === 'success'
					? '▶️ Exécution réussie'
					: '❌ Exécution échouée',
			isVolumeControl ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
		);

		this.contextValue = isVolumeControl ? 'volumeControl' : 'runSoundItem';
		this.iconPath = new vscode.ThemeIcon(
			isVolumeControl
				? isVolumeControl === 'increase' ? 'add' : 'remove'
				: enabled ? 'unmute' : 'mute'
		);

		this.tooltip = `Son : ${soundFile}
État : ${enabled ? 'Activé' : 'Désactivé'}
Volume : ${Math.round(volume * 100)}%`;

		if (!isVolumeControl) {
			this.description = `${enabled ? '🔊' : '🔇'} • ${Math.round(volume * 100)}%`;
		}

		this.command = {
			command: isVolumeControl
				? isVolumeControl === 'increase'
					? 'echocode.increaseRunVolume'
					: 'echocode.decreaseRunVolume'
				: 'echocode.playRunSound',
			title: 'Exécuter action',
			arguments: [this]
		};
	}
}

export class RunPythonTreeItem extends vscode.TreeItem {
	constructor() {
		super('Exécuter', vscode.TreeItemCollapsibleState.None);
		this.command = {
			command: 'echocode.runPythonWithSound',
			title: 'Exécuter Python avec son'
		};
		this.contextValue = 'runPython';
		this.iconPath = new vscode.ThemeIcon('play');
		this.tooltip = "Exécute le script Python actif et joue un son à la fin.";
	}
}
export class RunSoundTreeDataProvider2 implements vscode.TreeDataProvider<vscode.TreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<RunSoundTreeItem2 | undefined | void> = new vscode.EventEmitter();
	readonly onDidChangeTreeData: vscode.Event<RunSoundTreeItem2 | undefined | void> = this._onDidChangeTreeData.event;

	private runSounds: RunSound[] = [];

	constructor() {
		this.loadSounds();
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: RunSoundTreeItem2): vscode.ProviderResult<(RunSoundTreeItem2 | RunPythonTreeItem)[]> {
		if (!element) {
			const items: (RunSoundTreeItem2 | RunPythonTreeItem)[] = [];

			// 👇 Ajouter le bouton "Exécuter Python avec son" tout en haut
			items.push(new RunPythonTreeItem());

			// 🔊 Ajouter les sons post run
			items.push(...this.runSounds.map(s =>
				new RunSoundTreeItem2(s.type, s.soundFile, s.enabled, s.volume)
			));

			return items;
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
		const sound = this.runSounds.find(s => s.type === type);
		if (sound) {
			sound.enabled = !sound.enabled;
			this.saveSounds();
			this.refresh();
		}
	}

	updateVolume(type: RunSoundType, newVolume: number) {
		const sound = this.runSounds.find(s => s.type === type);
		if (sound) {
			sound.volume = Math.max(0, Math.min(1, newVolume));
			this.saveSounds();
			this.refresh();
		}
	}

	updateSoundFile(type: RunSoundType, newFile: string) {
		const sound = this.runSounds.find(s => s.type === type);
		if (sound) {
			sound.soundFile = newFile;
			this.saveSounds();
			this.refresh();
			vscode.window.showInformationMessage(`✅ Nouveau son pour "${type}" : ${newFile}`);
		}
	}

	getAll(): RunSound[] {
		return this.runSounds;
	}

	private loadSounds() {
		if (fs.existsSync(RUN_SOUNDS_FILE)) {
			try {
				const raw = fs.readFileSync(RUN_SOUNDS_FILE, 'utf-8');
				this.runSounds = JSON.parse(raw);
			} catch (err) {
				console.error('[EchoCode] ❌ Erreur de lecture du fichier runSounds.json :', err);
				this.setDefaultSounds();
			}
		} else {
			this.setDefaultSounds();
		}
	}

	private setDefaultSounds() {
		this.runSounds = [
			{ type: 'success', soundFile: 'success.mp3', enabled: true, volume: 0.8 },
			{ type: 'error', soundFile: 'error.mp3', enabled: true, volume: 0.8 }
		];
		this.saveSounds();
	}

	private saveSounds() {
		try {
			fs.writeFileSync(RUN_SOUNDS_FILE, JSON.stringify(this.runSounds, null, 2));
		} catch (err) {
			console.error('[EchoCode] ❌ Erreur de sauvegarde de runSounds.json :', err);
		}
	}
}
