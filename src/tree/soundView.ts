import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const SHORTCUTS_FILE = path.join(__dirname, '..', 'data', 'shortcuts.json');

export interface ShortcutConfig {
  shortcut: string;
  soundFile: string;
  enabled: boolean;
  isVisible: boolean;
  volume: number;
}

export class SoundTreeItem extends vscode.TreeItem {
  constructor(
    public readonly shortcut: string,
    public readonly config: Omit<ShortcutConfig, 'shortcut'>,
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
      this.tooltip = `Son: ${config.soundFile}\nÉtat: ${config.enabled ? 'Activé' : 'Désactivé'}\nVolume: ${Math.round(config.volume * 100)}%`;
      this.description = `${config.enabled ? '🔊' : '🔇'} • ${Math.round(config.volume * 100)}%`;
      this.contextValue = 'soundItem';
      this.iconPath = new vscode.ThemeIcon(config.enabled ? 'unmute' : 'mute');
      this.command = { command: 'echocode.playShortcutSound', title: 'Play', arguments: [this] };
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

export class AddShortcutTreeItem extends vscode.TreeItem {
  constructor() {
    super('➕ Ajouter un raccourci', vscode.TreeItemCollapsibleState.None);
    this.command = { command: 'echocode.addShortcut', title: 'Ajouter un raccourci' };
    this.contextValue = 'addShortcut';
  }
}

export class SoundTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private shortcuts: ShortcutConfig[] = [];

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
      const items = [new AddShortcutTreeItem(), ...this.shortcuts.filter(s => s.isVisible).map(s => new SoundTreeItem(s.shortcut, s))];
      return items;
    }

    if (element instanceof SoundTreeItem && !element.isVolumeControl) {
      return [
        new SoundTreeItem(element.shortcut, element.config, 'increase'),
        new SoundTreeItem(element.shortcut, element.config, 'decrease')
      ];
    }

    return [];
  }

  private updateShortcut(shortcut: string, updater: (s: ShortcutConfig) => void) {
    const found = this.shortcuts.find(s => s.shortcut === shortcut);
    if (found) {
      updater(found);
      this.saveShortcuts();
      this.refresh();
    }
  }

  toggleShortcut(shortcut: string) {
    this.updateShortcut(shortcut, s => (s.enabled = !s.enabled));
  }

  toggleVisibility(shortcut: string) {
    this.updateShortcut(shortcut, s => (s.isVisible = !s.isVisible));
  }

  updateVolume(shortcut: string, newVolume: number) {
    this.updateShortcut(shortcut, s => (s.volume = Math.max(0, Math.min(1, newVolume))));
  }

  updateSoundFile(shortcut: string, newFile: string) {
    this.updateShortcut(shortcut, s => (s.soundFile = newFile));
    vscode.window.showInformationMessage(`✅ Son mis à jour pour le raccourci "${shortcut}" : ${newFile}`);
  }

  addShortcut(shortcut: string, config: Omit<ShortcutConfig, 'shortcut'>) {
    this.shortcuts.push({ shortcut, ...config });
    this.saveShortcuts();
    this.refresh();
  }

  removeShortcut(shortcut: string) {
    this.updateShortcut(shortcut, s => (s.isVisible = false));
  }

  getShortcut(shortcut: string): ShortcutConfig | undefined {
    return this.shortcuts.find(s => s.shortcut === shortcut);
  }

  getAllShortcuts() {
    return this.shortcuts.map(({ shortcut, ...config }) => ({ shortcut, config }));
  }

  private loadShortcuts() {
    if (!fs.existsSync(SHORTCUTS_FILE)) {
      this.shortcuts = [];
      return;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(SHORTCUTS_FILE, 'utf-8'));
      this.shortcuts = Array.isArray(parsed)
        ? parsed.map((s: any) => ({ ...s, isVisible: typeof s.isVisible === 'boolean' ? s.isVisible : true }))
        : [];
    } catch (error) {
      console.error('❌ Erreur lors du chargement de shortcuts.json :', error);
      this.shortcuts = [];
    }
  }

  private saveShortcuts() {
    try {
      fs.writeFileSync(SHORTCUTS_FILE, JSON.stringify(this.shortcuts, null, 2));
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des raccourcis :', error);
    }
  }
}
