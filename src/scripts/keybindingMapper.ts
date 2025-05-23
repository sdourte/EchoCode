import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export type KeybindingMap = Record<string, string[]>;

function getDefaultKeybindingsPath(): string {
  return path.join(__dirname, '..', '..', 'src', 'data', 'defaultKeybindings.json');
}

export async function buildKeybindingMap(): Promise<KeybindingMap> {
  const bindingsPath = getDefaultKeybindingsPath();
  const result: KeybindingMap = {};
  console.log('Keybinding map is building...');

  try {
    const raw = fs.readFileSync(bindingsPath, 'utf-8');
    const parsed = JSON.parse(raw);

    const allCommands = await vscode.commands.getCommands(true);

    for (const item of parsed) {
      const key = item.key?.toLowerCase();
      const command = item.command;

      if (key && command && allCommands.includes(command)) {
        if (!result[key]) {
          result[key] = [];
        }
        result[key].push(command);
      }
    }
    console.log('Keybinding map result:', result);
  } catch (err) {
    console.warn('Erreur lors du chargement de defaultKeybindings.json :', err);
  }

  return result;
}

/**
 * Exécute les commandes natives associées à un raccourci clavier.
 */
export async function runDefaultCommandsForKey(key: string, map: KeybindingMap): Promise<void> {
  const commands = map[key.toLowerCase()];
  if (!commands) {return;}

  for (const cmd of commands) {
    try {
      await vscode.commands.executeCommand(cmd);
    } catch (err) {
      console.warn(`Échec d'exécution de ${cmd} :`, err);
    }
  }
}
