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

export class RunSoundTreeItem extends vscode.TreeItem {
  constructor(
    public readonly sound: RunSound,
    public readonly isVolumeControl?: 'increase' | 'decrease'
  ) {
    super(
      isVolumeControl === 'increase'
        ? 'Augmenter le volume'
        : isVolumeControl === 'decrease'
        ? 'Diminuer le volume'
        : sound.type === 'success'
        ? '▶️ Exécution réussie'
        : '❌ Exécution échouée',
			isVolumeControl ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
    );
    

    this.contextValue = isVolumeControl ? 'volumeControl' : 'runSoundItem';
    this.iconPath = new vscode.ThemeIcon(
      isVolumeControl ? (isVolumeControl === 'increase' ? 'add' : 'remove') : sound.enabled ? 'unmute' : 'mute'
    );

    this.tooltip = `Son : ${sound.soundFile}\nÉtat : ${sound.enabled ? 'Activé' : 'Désactivé'}\nVolume : ${Math.round(sound.volume * 100)}%`;
    this.description = !isVolumeControl ? `${sound.enabled ? '🔊' : '🔇'} • ${Math.round(sound.volume * 100)}%` : undefined;

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
    this.command = { command: 'echocode.runPythonWithSound', title: 'Exécuter Python avec son' };
    this.contextValue = 'runPython';
    this.iconPath = new vscode.ThemeIcon('play');
    this.tooltip = 'Exécute le script Python actif et joue un son à la fin.';
  }
}

export class RunSoundTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

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

  getChildren(element?: RunSoundTreeItem): vscode.ProviderResult<(RunSoundTreeItem | RunPythonTreeItem)[]> {
    if (!element) {
      return [new RunPythonTreeItem(), ...this.runSounds.map(s => new RunSoundTreeItem(s))];
    }

    if (!element.isVolumeControl) {
      return [
        new RunSoundTreeItem(element.sound, 'increase'),
        new RunSoundTreeItem(element.sound, 'decrease')
      ];
    }

    return [];
  }

  private updateSound(type: RunSoundType, updater: (s: RunSound) => void) {
    const sound = this.runSounds.find(s => s.type === type);
    if (sound) {
      updater(sound);
      this.saveSounds();
      this.refresh();
    }
  }

  toggle(type: RunSoundType) {
    this.updateSound(type, s => (s.enabled = !s.enabled));
  }

  updateVolume(type: RunSoundType, newVolume: number) {
    this.updateSound(type, s => (s.volume = Math.max(0, Math.min(1, newVolume))));
  }

  updateSoundFile(type: RunSoundType, newFile: string) {
    this.updateSound(type, s => (s.soundFile = newFile));
    vscode.window.showInformationMessage(`✅ Nouveau son pour "${type}" : ${newFile}`);
  }

  getAll(): RunSound[] {
    return this.runSounds;
  }

  private loadSounds() {
    if (!fs.existsSync(RUN_SOUNDS_FILE)) {
      return this.setDefaultSounds();
    }

    try {
      const raw = fs.readFileSync(RUN_SOUNDS_FILE, 'utf-8');
      this.runSounds = JSON.parse(raw);
    } catch (err) {
      console.error('[EchoCode] ❌ Erreur de lecture du fichier runSounds.json :', err);
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
