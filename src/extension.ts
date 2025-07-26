import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SoundTreeDataProvider, SoundTreeItem } from './tree/soundView';
import { RunSoundTreeDataProvider, RunSoundTreeItem } from './tree/soundTerminal';
import { initializeTodo, getTasks, getMode, addTask, toggleTask, updateTask, moveTask, deleteTask, setMode, loadReviewFromText } from './scripts/todo';

let soundWebviewPanel: vscode.WebviewPanel | undefined;

// Function to update the webview with the current tasks and mode
function updateWebview() {
  soundWebviewPanel?.webview.postMessage({
    type: 'updateTasks',
    tasks: getTasks(),
    mode: getMode()
  });
}

// Function to create or show the sound webview
function createOrShowSoundWebView(context: vscode.ExtensionContext) {
  if (soundWebviewPanel) {return;}

  soundWebviewPanel = vscode.window.createWebviewPanel(
    'echocodeSoundPlayer',
    'To-Do List',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))],
      retainContextWhenHidden: true
    }
  );

  const htmlPath = path.join(context.extensionPath, 'src', 'webview', 'soundPlayer.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace(
    /vscode-resource:media\//g,
    soundWebviewPanel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'media'))
    ).toString() + '/'
  );

  soundWebviewPanel.webview.html = html;

  // Préchargement des sons
  const mediaFolder = path.join(context.extensionPath, 'media');
  const allSounds = fs.existsSync(mediaFolder)
    ? fs.readdirSync(mediaFolder).filter(f => f.endsWith('.wav') || f.endsWith('.mp3'))
    : [];

  soundWebviewPanel.webview.postMessage({
    type: 'init',
    preloadSounds: allSounds,
    mediaBaseUrl: soundWebviewPanel.webview.asWebviewUri(
      vscode.Uri.file(mediaFolder)
    ).toString() + '/',
    todo: { mode: getMode(), tasks: getTasks() }
  });

  soundWebviewPanel.onDidDispose(() => (soundWebviewPanel = undefined));

  soundWebviewPanel.webview.onDidReceiveMessage((message) => {
    switch (message.type) {
      case 'addTask':
        if (getMode() === 'editable' || getMode() === 'review') {
          addTask(message.text, message.isTitle);
          updateWebview();
        }
        break;
      case 'toggleTask':
        toggleTask(message.index);
        updateWebview();
        break;
      case 'switchMode':
        const newMode = getMode() === 'editable' ? 'review' : 'editable';
        setMode(newMode);
        updateWebview();
        break;
      case 'updateTask':
        if (getMode() === 'editable') {
          updateTask(message.index, message.text);
          updateWebview();
        }
        break;
      case 'deleteTask':
        if (getMode() === 'editable') {
          deleteTask(message.index);
          updateWebview();
        }
        break;
      case 'moveTaskUp':
        if (getMode() === 'editable') {
          moveTask(message.index, message.index - 1);
          updateWebview();
        }
        break;
      case 'moveTaskDown':
        if (getMode() === 'editable') {
          moveTask(message.index, message.index + 1);
          updateWebview();
        }
        break;
      case 'importCustomTodo':
        vscode.window.showOpenDialog({
          title: 'Importer un fichier To-Do personnalisé',
          canSelectMany: false,
          filters: { 'Fichiers texte': ['txt'] }
        }).then(fileUri => {
          if (fileUri && fileUri[0]) {
            try {
              // true => active le parsing custom (# titres, ||tâches||)
              loadReviewFromText(fileUri[0].fsPath, true);
              updateWebview();
              vscode.window.showInformationMessage('✅ To-Do Review importé avec succès.');
            } catch (err) {
              vscode.window.showErrorMessage('❌ Erreur lors de l\'import du fichier personnalisé.');
              console.error(err);
            }
          }
        });
        break;
      case 'soundActivationConfirmed':
        vscode.window.showInformationMessage('🔊 Sons activés !');
        break;
    }
  });
}

// Function to play sound in the webview
function playSoundWebview(shortcut: string, soundFile: string, enabled: boolean, volume: number) {
  if (!soundWebviewPanel) {return;}
  if (enabled) {
    soundWebviewPanel.webview.postMessage({ sound: soundFile, enabled, volume });
    console.log(`🔊 Son joué pour le raccourci "${shortcut}": ${soundFile} (Volume: ${volume})`);
  } else {
    vscode.window.showWarningMessage(
      shortcut ? `Le son du raccourci "${shortcut}" est désactivé.` : `Le son du raccourci est désactivé.`
    );
  }
}

// activate function to initialize the extension
export async function activate(context: vscode.ExtensionContext) {
  console.log('EchoCode activé !');

  initializeTodo(context);

  const soundTreeDataProvider = new SoundTreeDataProvider();
  vscode.window.registerTreeDataProvider('soundExplorer', soundTreeDataProvider);

  const runSoundProvider = new RunSoundTreeDataProvider();
  vscode.window.registerTreeDataProvider('runSounds', runSoundProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand('echocode.start', () => {
      createOrShowSoundWebView(context);
      vscode.window.showInformationMessage('Cliquez une fois sur la To-Do List pour activer les sons');
    })
  );

  vscode.commands.executeCommand('echocode.start');

  const todoStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  todoStatusBarItem.text = '$(unmute) Ouvrir To-Do List';
  todoStatusBarItem.tooltip = 'Ouvrir To-Do List EchoCode';
  todoStatusBarItem.command = 'echocode.start';
  todoStatusBarItem.show();

  const EMPTY_SOUND = 'empty.mp3';
  const mappingPath = path.join(context.extensionPath, 'src', 'data', 'nativeCommandMap.json');
  const nativeCommandMap: Record<string, string> = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));

  // --- Récupération des raccourcis visibles depuis la TreeView ---
  const shortcuts = soundTreeDataProvider.getAllShortcuts();

  // --- Enregistrement dynamique des commandes ---
  shortcuts.forEach((item) => {
    const normalized = item.shortcut.replace(/\W+/g, '').toLowerCase();
    const commandId = `echocode.shortcut.${normalized}`;

    const command = vscode.commands.registerCommand(commandId, async () => {
      const config = soundTreeDataProvider.getShortcut(item.shortcut);
      if (!config) {return;}

      playSoundWebview(item.shortcut, config.soundFile || EMPTY_SOUND, config.enabled, config.volume ?? 1);

      const native = nativeCommandMap[commandId];
      if (native) {await vscode.commands.executeCommand(native);}
    });

    context.subscriptions.push(command);
  });

  // --- Commandes de la TreeView des raccourcis ---
  context.subscriptions.push(
    vscode.commands.registerCommand('echocode.toggleEnabled', (item: SoundTreeItem) =>
      soundTreeDataProvider.toggleShortcut(item.shortcut)
    ),
    vscode.commands.registerCommand('echocode.increaseVolume', (item: SoundTreeItem) =>
      soundTreeDataProvider.updateVolume(item.shortcut, item.config.volume + 0.1)
    ),
    vscode.commands.registerCommand('echocode.decreaseVolume', (item: SoundTreeItem) =>
      soundTreeDataProvider.updateVolume(item.shortcut, item.config.volume - 0.1)
    ),
    vscode.commands.registerCommand('echocode.changeSound', async (item: SoundTreeItem) => {
      const mediaFolder = path.join(context.extensionPath, 'media');
      const files = fs.readdirSync(mediaFolder).filter(f => f.endsWith('.mp3'));
      const selected = await vscode.window.showQuickPick(files, { placeHolder: 'Choisissez un nouveau son' });
      if (selected) {soundTreeDataProvider.updateSoundFile(item.shortcut, selected);}
    }),
    vscode.commands.registerCommand('echocode.addShortcut', async () => {
      const packagePath = path.join(context.extensionPath, 'package.json');
      if (!fs.existsSync(packagePath)) {return vscode.window.showErrorMessage('❌ Fichier package.json introuvable.');}

      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      const allowedShortcuts = (packageData?.contributes?.keybindings || [])
        .map((kb: any) => kb.key)
        .filter((key: string) => typeof key === 'string' && key.trim() !== '')
        .sort((a: string, b: string) => a.localeCompare(b, 'fr'));

      if (!allowedShortcuts.length) {return vscode.window.showWarningMessage('⚠️ Aucun raccourci défini.');}

      const shortcut = await vscode.window.showQuickPick(allowedShortcuts, { placeHolder: 'Choisissez un raccourci' });
      if (!shortcut) {return;}

      const mediaFolder = path.join(context.extensionPath, 'media');
      const soundFile = await vscode.window.showQuickPick(
        fs.readdirSync(mediaFolder).filter(f => /\.(mp3|wav|ogg)$/.test(f)),
        { placeHolder: 'Choisissez un fichier son' }
      );
      if (!soundFile) {return;}

      const existing = soundTreeDataProvider.getShortcut(shortcut);
      if (existing) {
        if (existing.isVisible) {
          vscode.window.showWarningMessage(`🔁 Le raccourci "${shortcut}" existe déjà et est actif.`);
        } else {
          soundTreeDataProvider.toggleVisibility(shortcut);
          soundTreeDataProvider.updateSoundFile(shortcut, soundFile);
        }
      } else {
        soundTreeDataProvider.addShortcut(shortcut, {
          soundFile,
          enabled: true,
          isVisible: true,
          volume: 1.0
        });
      }
    }),
    vscode.commands.registerCommand('echocode.removeShortcut', async (item: SoundTreeItem) => {
      const confirm = await vscode.window.showWarningMessage(
        `Supprimer le raccourci "${item.shortcut}" ? (il sera masqué)`,
        { modal: true },
        'Oui'
      );
      if (confirm === 'Oui') {
        soundTreeDataProvider.toggleVisibility(item.shortcut);
        item.config.soundFile = EMPTY_SOUND;
    vscode.window.showInformationMessage(`✅ Raccourci "${item.shortcut}" supprimé.`);
      }
    }),
    vscode.commands.registerCommand('echocode.playShortcutSound', (item: SoundTreeItem) =>
      playSoundWebview(item.shortcut, item.config.soundFile, item.config.enabled, item.config.volume)
    )
  );

  // --- Commandes des sons post-exécution ---
  context.subscriptions.push(
    vscode.commands.registerCommand('echocode.playRunSound', (item: RunSoundTreeItem) =>
      playSoundWebview('', item.sound.soundFile, item.sound.enabled, item.sound.volume)
    ),
    vscode.commands.registerCommand('echocode.increaseRunVolume', (item: RunSoundTreeItem) =>
      runSoundProvider.updateVolume(item.sound.type, item.sound.volume + 0.1)
    ),
    vscode.commands.registerCommand('echocode.decreaseRunVolume', (item: RunSoundTreeItem) =>
      runSoundProvider.updateVolume(item.sound.type, item.sound.volume - 0.1)
    ),
    vscode.commands.registerCommand('echocode.toggleRunSound', (item: RunSoundTreeItem) =>
      runSoundProvider.toggle(item.sound.type)
    ),
    vscode.commands.registerCommand('echocode.changeRunSound', async (item: RunSoundTreeItem) => {
      const mediaFolder = path.join(context.extensionPath, 'media');
      const selected = await vscode.window.showQuickPick(
        fs.readdirSync(mediaFolder).filter(f => /\.(mp3|wav|ogg)$/.test(f)),
        { placeHolder: 'Choisissez un nouveau son pour ce type' }
      );
      if (selected) {runSoundProvider.updateSoundFile(item.sound.type, selected);}
    })
  );

  // --- Import de sons ---
  context.subscriptions.push(
    vscode.commands.registerCommand('echocode.importSound', async () => {
      const fileUri = await vscode.window.showOpenDialog({
        title: 'Importer un son personnalisé',
        canSelectMany: false,
        filters: { 'Fichiers audio': ['wav', 'mp3', 'ogg'] }
      });
      if (!fileUri || !fileUri[0]) {return;}

      const sourcePath = fileUri[0].fsPath;
      const fileName = path.basename(sourcePath);
      const destPath = path.join(context.extensionPath, 'media', fileName);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      try {
        fs.copyFileSync(sourcePath, destPath);
        vscode.window.showInformationMessage(`✅ Son "${fileName}" importé avec succès !`);
        soundWebviewPanel?.webview.postMessage({
          type: 'newSoundImported',
          sound: fileName,
          mediaBaseUrl: soundWebviewPanel.webview.asWebviewUri(
            vscode.Uri.file(path.join(context.extensionPath, 'media'))
          ).toString() + '/'
        });
      } catch (err) {
        vscode.window.showErrorMessage('❌ Échec de l\'import du son.');
        console.error(err);
      }
    })
  );

  // --- Exécution Python avec son ---
  context.subscriptions.push(
    vscode.commands.registerCommand('echocode.runPythonWithSound', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {return vscode.window.showErrorMessage('Aucun fichier ouvert.');}

      const filePath = editor.document.fileName;
      const taskName = 'Run Python with Sound';
      const task = new vscode.Task(
        { type: 'shell' },
        vscode.TaskScope.Workspace,
        taskName,
        'EchoCode',
        new vscode.ShellExecution(`python "${filePath}"`)
      );

      const disposable = vscode.tasks.onDidEndTaskProcess((e) => {
        if (e.execution.task.name === taskName) {
          const type = e.exitCode === 0 ? 'success' : 'error';
          const soundConfig = runSoundProvider.getAll().find(s => s.type === type);
          if (soundConfig && soundConfig.enabled) {
            playSoundWebview('', soundConfig.soundFile, true, soundConfig.volume);
          }
          disposable.dispose();
        }
      });

      vscode.tasks.executeTask(task);
    })
  );
}

export function deactivate() {}
