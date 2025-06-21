import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SoundTreeDataProvider, SoundTreeItem } from './tree/soundView';
import { RunSoundTreeDataProvider2, RunSoundTreeItem2, RunSoundType } from './tree/soundTerminal';
import { exec } from 'child_process';
import { buildKeybindingMap, runDefaultCommandsForKey } from './scripts/keybindingMapper';
import { initializeTodo, getTasks, getMode, addTask, toggleTask, updateTask, moveTask, deleteTask, setMode, loadCustomReviewText } from './scripts/todo';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

let soundWebviewPanel: vscode.WebviewPanel | undefined;

let listenerProcess: ChildProcessWithoutNullStreams;

// Cette fonction doit être appelée dans activate()
function startKeyListener(context: vscode.ExtensionContext, soundTreeDataProvider: any, playSoundWebview: Function) {
	console.log('[KeyListener] Démarrage du listener de raccourcis clavier...');
	const scriptPath = path.join(context.extensionPath, 'out', 'scripts', 'keyListener.js');

	listenerProcess = spawn('node', [scriptPath]);
	console.log(`[KeyListener] Processus lancé : ${scriptPath}`);
	listenerProcess.stdout.on('data', (data) => {
		const line = data.toString().trim();
		console.log(`[KeyListener] STDOUT: ${line}`);
		if (line.startsWith('KEY:')) {
			console.log(`[KeyListener] Raccourci détecté : ${line}`);
			const shortcut = line.replace('KEY:', '');

			const item = soundTreeDataProvider.getShortcut(shortcut);
			if (item && item.enabled) {
				playSoundWebview(item.soundFile, item.enabled, item.volume);
				console.log(`▶️ ${shortcut} → ${item.soundFile}`);
			} else {
				console.log(`⏭️ Aucun son trouvé ou désactivé pour : ${shortcut}`);
			}
		}
	});

	listenerProcess.stderr.on('data', (data) => {
		console.error('[KeyListener] STDERR:', data.toString());
	});

	listenerProcess.on('close', (code) => {
		console.log(`[KeyListener] Process exited with code ${code}`);
	});
}


function updateKeybindings(context: vscode.ExtensionContext): Promise<void> {
	const extensionRoot = context.extensionPath;
	const command = 'npm run update:keybindings';

	return new Promise((resolve, reject) => {
		exec(command, { cwd: extensionRoot }, (error, stdout, stderr) => {
			if (error) {
				console.error(`Erreur lors de la génération des keybindings : ${error.message}`);
				vscode.window.showErrorMessage(`❌ Erreur lors de la génération des keybindings : ${error.message}`);
				return reject(error);
			}

			if (stderr) {
				console.warn(`⚠️ Warnings lors de la génération des keybindings : ${stderr}`);
			}

			console.log(`✅ Keybindings générés : ${stdout}`);
			vscode.window.showInformationMessage('✅ Keybindings mis à jour avec succès !');
			resolve();
		});
	});
}

function updateWebview() {
	soundWebviewPanel?.webview.postMessage({
		type: 'updateTasks',
		tasks: getTasks(),
		mode: getMode()
	});
}

function createOrShowSoundWebView(context: vscode.ExtensionContext) {
	if (soundWebviewPanel) {
		{return;}
	}

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

	html = html.replace(/vscode-resource:media\//g, soundWebviewPanel.webview.asWebviewUri(
		vscode.Uri.file(path.join(context.extensionPath, 'media'))).toString() + '/');

	soundWebviewPanel.webview.html = html;

	const allSounds = new Set<string>();
	const mediaFolder = path.join(context.extensionPath, 'media');
	if (fs.existsSync(mediaFolder)) {
		const files = fs.readdirSync(mediaFolder);
		files.forEach(file => {
			if (file.endsWith('.wav') || file.endsWith('.mp3')) {
				allSounds.add(`${file}`);
			}
		});
	}
	soundWebviewPanel.webview.postMessage({
		type: "init",
		preloadSounds: Array.from(allSounds),
		todo: {
			mode: getMode(),
			tasks: getTasks()
		}
	});

	soundWebviewPanel.onDidDispose(() => {
		soundWebviewPanel = undefined;
	});

	// Ajoute la gestion du type dans la réception des messages
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
					title: "Importer un fichier To-Do personnalisé",
					canSelectMany: false,
					filters: { 'Fichiers texte': ['txt'] }
				}).then(fileUri => {
					if (fileUri && fileUri[0]) {
						try {
							loadCustomReviewText(fileUri[0].fsPath);
							updateWebview();
							vscode.window.showInformationMessage('✅ To-Do Review importé avec succès.');
						} catch (err) {
							vscode.window.showErrorMessage("❌ Erreur lors de l'import du fichier personnalisé.");
							console.error(err);
						}
					}
				});
				break;
		}
	});
}

function playSoundWebview(soundFile: string, enabled: boolean, volume: number) {
	if (soundWebviewPanel) {
		if (enabled) {
			soundWebviewPanel.webview.postMessage({ sound: soundFile, enabled, volume });
		} else {
			vscode.window.showWarningMessage(`Le son \"${soundFile}\" est désactivé.`);
		}
	}
}

export async function activate(context: vscode.ExtensionContext) {
	console.log('EchoCode activé !');

	initializeTodo(context);

	const startDisposable = vscode.commands.registerCommand('echocode.start', () => {
		vscode.window.showInformationMessage('Starting EchoCode!');
		createOrShowSoundWebView(context);
		vscode.window.showInformationMessage("Cliquez une fois sur la To-Do List pour activer les sons");
	});
	context.subscriptions.push(startDisposable);

	vscode.commands.executeCommand('echocode.start');

	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	statusBarItem.text = '$(unmute) EchoCode';
	statusBarItem.tooltip = 'Ouvrir EchoCode';
	statusBarItem.command = 'echocode.start';
	statusBarItem.show();

	const soundTreeDataProvider = new SoundTreeDataProvider();
	vscode.window.registerTreeDataProvider('soundExplorer', soundTreeDataProvider);

	const runSoundProvider = new RunSoundTreeDataProvider2();
	vscode.window.registerTreeDataProvider('runSounds', runSoundProvider);

	// 🧠 ➜ Lancement du listener basé sur keyListener.ts
	startKeyListener(context, soundTreeDataProvider, playSoundWebview);

	// ❌ SUPPRIMÉ : plus besoin des dynamicShortcutCommands ni keybindingMap

	const treeViewCommands = [
		vscode.commands.registerCommand('echocode.toggleEnabled', (item: SoundTreeItem) => {
			soundTreeDataProvider.toggleShortcut(item.shortcut);
		}),
		vscode.commands.registerCommand('echocode.increaseVolume', (item: SoundTreeItem) => {
			soundTreeDataProvider.updateVolume(item.shortcut, item.volume + 0.1);
		}),
		vscode.commands.registerCommand('echocode.decreaseVolume', (item: SoundTreeItem) => {
			soundTreeDataProvider.updateVolume(item.shortcut, item.volume - 0.1);
		}),
		vscode.commands.registerCommand('echocode.changeSound', async (item: SoundTreeItem) => {
			if (!item) { {return;} }
			const mediaFolder = path.join(context.extensionPath, 'media');
			const files = fs.readdirSync(mediaFolder).filter(f => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg'));
			const selected = await vscode.window.showQuickPick(files, {
				placeHolder: 'Choisissez un nouveau son pour ce raccourci'
			});
			if (selected) {
				soundTreeDataProvider.updateSoundFile(item.shortcut, selected);
			}
		}),
		vscode.commands.registerCommand('echocode.addShortcut', async () => {
			const keybindingsPath = path.join(context.extensionPath, 'src', 'data', 'defaultKeybindings.json');
			if (!fs.existsSync(keybindingsPath)) {
				vscode.window.showErrorMessage('❌ Fichier defaultKeybindings.json introuvable.');
				{return;}
			}

			let parsed: any[] = [];
			try {
				parsed = JSON.parse(fs.readFileSync(keybindingsPath, 'utf-8'));
			} catch (e) {
				vscode.window.showErrorMessage('❌ Erreur de parsing du fichier defaultKeybindings.json');
				console.error(e);
				{return;}
			}

			const allKeys = [...new Set(parsed.map(entry => entry.key).filter((key: string | undefined) => typeof key === 'string' && key.trim() !== ''))]
				.sort((a, b) => a.localeCompare(b, 'fr'));

			allKeys.push('✏️ Entrer manuellement...');

			const shortcutPick = await vscode.window.showQuickPick(allKeys, {
				placeHolder: 'Choisissez un raccourci clavier depuis les keybindings'
			});

			let shortcut: string | undefined;

			if (!shortcutPick) {return;}
			if (shortcutPick === '✏️ Entrer manuellement...') {
				shortcut = await vscode.window.showInputBox({
					prompt: 'Entrez votre raccourci personnalisé (ex: Ctrl+Alt+M)'
				});
			} else {
				shortcut = shortcutPick;
			}

			if (!shortcut) {return;}

			const mediaFolder = path.join(context.extensionPath, 'media');
			const files = fs.readdirSync(mediaFolder).filter(f =>
				f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg'));

			const soundFile = await vscode.window.showQuickPick(files, {
				placeHolder: 'Choisissez un fichier son existant dans media/'
			});

			const existing = soundTreeDataProvider.getShortcut(shortcut);
			if (existing) {
				vscode.window.showWarningMessage(`Le raccourci "${shortcut}" existe déjà avec le son : ${existing.soundFile}`);
				{return;}
			}

			if (soundFile) {
				soundTreeDataProvider.addShortcut({ shortcut, soundFile, enabled: true, volume: 1 });
				vscode.window.showInformationMessage(`✅ Raccourci ajouté : ${shortcut}`);
				vscode.window.showInformationMessage('🔄 Rechargement de la fenêtre pour appliquer les changements...');
				await vscode.commands.executeCommand('workbench.action.reloadWindow');
			}
		}),
		vscode.commands.registerCommand('echocode.removeShortcut', async (item: SoundTreeItem) => {
			if (!item) {return;}
			const confirm = await vscode.window.showWarningMessage(
				`Supprimer le raccourci "${item.shortcut}" ?`,
				{ modal: true },
				'Oui'
			);
			if (confirm === 'Oui') {
				soundTreeDataProvider.removeShortcut(item.shortcut);
				vscode.window.showInformationMessage(`❌ Raccourci supprimé : ${item.shortcut}`);
				vscode.window.showInformationMessage('🔄 Rechargement de la fenêtre pour appliquer les changements...');
				await vscode.commands.executeCommand('workbench.action.reloadWindow');
			}
		}),
		vscode.commands.registerCommand('echocode.playShortcutSound', (item: SoundTreeItem) => {
			if (!item) {return;}
			playSoundWebview(item.soundFile, item.enabled, item.volume);
		})
	];

	const runSoundCommands = [
		vscode.commands.registerCommand('echocode.playRunSound', (item: RunSoundTreeItem2) => {
			playSoundWebview(item.soundFile, item.enabled, item.volume);
		}),
		vscode.commands.registerCommand('echocode.increaseRunVolume', (item: RunSoundTreeItem2) => {
			runSoundProvider.updateVolume(item.type, item.volume + 0.1);
		}),
		vscode.commands.registerCommand('echocode.decreaseRunVolume', (item: RunSoundTreeItem2) => {
			runSoundProvider.updateVolume(item.type, item.volume - 0.1);
		}),
		vscode.commands.registerCommand('echocode.toggleRunSound', (item: RunSoundTreeItem2) => {
			runSoundProvider.toggle(item.type);
		}),
		vscode.commands.registerCommand('echocode.changeRunSound', async (item: RunSoundTreeItem2) => {
			if (!item) {return;}
			const mediaFolder = path.join(context.extensionPath, 'media');
			const files = fs.readdirSync(mediaFolder).filter(f => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg'));
			const selected = await vscode.window.showQuickPick(files, {
				placeHolder: 'Choisissez un nouveau son pour ce type'
			});
			if (selected) {
				runSoundProvider.updateSoundFile(item.type, selected);
			}
		})
	];

	const importSoundCommand = vscode.commands.registerCommand('echocode.importSound', async () => {
		const fileUri = await vscode.window.showOpenDialog({
			title: "Importer un son personnalisé",
			canSelectMany: false,
			filters: { 'Fichiers audio': ['wav', 'mp3', 'ogg'] }
		});
		if (!fileUri || fileUri.length === 0) {return;}

		const sourcePath = fileUri[0].fsPath;
		const fileName = path.basename(sourcePath);
		const destPath = path.join(context.extensionPath, 'media', fileName);

		if (!fs.existsSync(path.dirname(destPath))) {
			fs.mkdirSync(path.dirname(destPath), { recursive: true });
		}

		try {
			fs.copyFileSync(sourcePath, destPath);
			vscode.window.showInformationMessage(`✅ Son "${fileName}" importé avec succès !`);

			if (soundWebviewPanel) {
				soundWebviewPanel.webview.postMessage({
					type: 'newSoundImported',
					sound: fileName
				});
			}
		} catch (err) {
			console.error(err);
			vscode.window.showErrorMessage("❌ Échec de l'import du son.");
		}
	});
	context.subscriptions.push(importSoundCommand);

	vscode.window.onDidEndTerminalShellExecution((event) => {
		const exitCode = event.exitCode;
		const success = exitCode === 0;
		const type: RunSoundType = success ? 'success' : 'error';
		const runSound = runSoundProvider.getAll().find(s => s.type === type);
		if (runSound && runSound.enabled) {
			playSoundWebview(runSound.soundFile, runSound.enabled, runSound.volume);
		}
		event.terminal.show(false);
	});

	[...treeViewCommands, ...runSoundCommands].forEach(cmd => context.subscriptions.push(cmd));
}


export function deactivate() {
    if (listenerProcess) {
        listenerProcess.kill();
    }
}
