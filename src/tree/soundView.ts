import * as vscode from 'vscode';
import * as path from 'path';

export interface SoundShortcut {
  shortcut: string;
  soundFile: string;
  enabled: boolean;
  volume: number; // 0 to 1
}

export class SoundTreeItem extends vscode.TreeItem {
  constructor(
    public readonly shortcut: string,
    public readonly soundFile: string,
    public readonly enabled: boolean,
    public readonly volume: number
  ) {
    super(shortcut, vscode.TreeItemCollapsibleState.None);

    this.tooltip = `Son: ${soundFile}\nÉtat: ${enabled ? 'Activé' : 'Désactivé'}\nVolume: ${Math.round(volume * 100)}%`;
    this.description = `${soundFile} • ${enabled ? '🔊' : '🔇'} • ${Math.round(volume * 100)}%`;
    this.contextValue = 'soundItem';
    this.iconPath = new vscode.ThemeIcon(enabled ? 'unmute' : 'mute');

	// Clic gauche = joue le son
	this.command = {
		command: 'echocode.playShortcutSound',
		title: 'Play',
		arguments: [this]
	};
  }
}

export class SoundTreeDataProvider implements vscode.TreeDataProvider<SoundTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SoundTreeItem | undefined | void> = new vscode.EventEmitter<SoundTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<SoundTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  private shortcuts: SoundShortcut[];

  constructor() {
    // Tu peux démarrer avec quelques exemples
    this.shortcuts = [
      { shortcut: 'Ctrl+C', soundFile: 'ctrlC.mp3', enabled: true, volume: 1 },
      { shortcut: 'Ctrl+V', soundFile: 'ctrlV.mp3', enabled: true, volume: 1 },
	  { shortcut: 'Ctrl+Z', soundFile: 'ctrlZ.mp3', enabled: true, volume: 1 },
	  { shortcut: 'Ctrl+Y', soundFile: 'ctrlY.mp3', enabled: true, volume: 1 },
	  { shortcut: 'Ctrl+S', soundFile: 'ctrlS.mp3', enabled: true, volume: 1 }
    ];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SoundTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<SoundTreeItem[]> {
    return Promise.resolve(this.shortcuts.map(s => new SoundTreeItem(s.shortcut, s.soundFile, s.enabled, s.volume)));
  }

  toggleShortcut(shortcut: string) {
    const item = this.shortcuts.find(s => s.shortcut === shortcut);
    if (item) {
      item.enabled = !item.enabled;
      this.refresh();
    }
  }

  updateVolume(shortcut: string, newVolume: number) {
    const item = this.shortcuts.find(s => s.shortcut === shortcut);
    if (item) {
      item.volume = Math.max(0, Math.min(1, newVolume));
      this.refresh();
    }
  }

  updateSoundFile(shortcut: string, newFile: string) {
    const item = this.shortcuts.find(s => s.shortcut === shortcut);
    if (item) {
      item.soundFile = newFile;
      this.refresh();
    }
  }

  addShortcut(newShortcut: SoundShortcut) {
    this.shortcuts.push(newShortcut);
    this.refresh();
  }

  removeShortcut(shortcut: string) {
	this.shortcuts = this.shortcuts.filter(s => s.shortcut !== shortcut);
	this.refresh(); // si tu stockes dans un fichier
  }

  getShortcut(shortcut: string): SoundShortcut | undefined {
    return this.shortcuts.find(s => s.shortcut === shortcut);
  }

  getAllShortcuts(): SoundShortcut[] {
    return this.shortcuts;
  }
}
