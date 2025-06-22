import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SoundTreeDataProvider, SoundTreeItem } from './tree/soundView';
import { RunSoundTreeDataProvider2, RunSoundTreeItem2, RunSoundType } from './tree/soundTerminal';
import { exec } from 'child_process';
import { buildKeybindingMap, runDefaultCommandsForKey } from './scripts/keybindingMapper';
import { initializeTodo, getTasks, getMode, addTask, toggleTask, updateTask, moveTask, deleteTask, setMode, loadCustomReviewText } from './scripts/todo';

let soundWebviewPanel: vscode.WebviewPanel | undefined;

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
		mediaBaseUrl: soundWebviewPanel.webview.asWebviewUri(
			vscode.Uri.file(path.join(context.extensionPath, 'media'))
		).toString() + '/',
		todo: {
			mode: getMode(),
			tasks: getTasks()
		}
	});

	soundWebviewPanel.onDidDispose(() => {
		soundWebviewPanel = undefined;
	});

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
			case 'soundActivationConfirmed':
				vscode.window.showInformationMessage("🔊 Sons activés !");
				break;

		}
	});
}

function playSoundWebview(shortcut: string, soundFile: string, enabled: boolean, volume: number) {
	if (soundWebviewPanel) {
		if (enabled) {
			soundWebviewPanel.webview.postMessage({ sound: soundFile, enabled, volume });
		} 
		else {
			if (shortcut !== '') {
			vscode.window.showWarningMessage(`Le son du raccourci \"${shortcut}\" est désactivé.`);
			}
			else {
				vscode.window.showWarningMessage(`Le son du raccourci est désactivé.`);
			}
		}
	}
}


// Declare soundTreeDataProvider at module scope so it is accessible everywhere
let soundTreeDataProvider: SoundTreeDataProvider;

export async function activate(context: vscode.ExtensionContext) {
	console.log('EchoCode activé !');

	initializeTodo(context);

	soundTreeDataProvider = new SoundTreeDataProvider();
	vscode.window.registerTreeDataProvider('soundExplorer', soundTreeDataProvider);

	const runSoundProvider = new RunSoundTreeDataProvider2();
	vscode.window.registerTreeDataProvider('runSounds', runSoundProvider);

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

	const EMPTY_SOUND = "empty.mp3";

	// Après getAllShortcuts, filtre uniquement les raccourcis visibles
	const shortcuts = soundTreeDataProvider.getAllShortcuts();

	console.log("SHORTCUTS LOADED:", shortcuts);

	// Mapping des raccourcis aux commandes
	const keybindingMap = await buildKeybindingMap();

	const dynamicShortcutCommands = shortcuts.map((item) => {
		const normalized = item.shortcut
			.replace(/\+/g, '')
			.replace(/\s/g, '')
			.replace(/-/g, '')
			.replace(/[^a-zA-Z0-9]/g, '');

		const commandId = `echocode.shortcut.${normalized.toLowerCase()}`;

		const command = vscode.commands.registerCommand(commandId, async () => {
			console.log(`✅ Commande déclenchée : ${commandId}`);

			const config = soundTreeDataProvider.getShortcut(item.shortcut);
			if (!config) {
				console.warn(`⚠️ Aucune config trouvée pour ${item.shortcut}`);
				return;
			}

			const soundFile = config.soundFile || EMPTY_SOUND;
			const visible = config.isVisible;
			const enabled = config.enabled;
			const volume = config.volume ?? 1;

			// ▶️ Toujours jouer un son (silencieux ou non)
			playSoundWebview(item.shortcut, soundFile, enabled, volume);

			// 🎯 Exécuter la commande réelle (VSCode)
			const shortcutKey = item.shortcut.toLowerCase().trim();
			const editorCommand = keybindingMap[shortcutKey]?.find(cmd => cmd.includes("editor"));
			if (editorCommand) {
				console.log(`🧭 Commande VSCode liée trouvée : ${editorCommand}`);
				await vscode.commands.executeCommand(editorCommand);
			} else {
				console.log(`🪂 Fallback : aucune commande éditeur pour ${shortcutKey}`);
				await runDefaultCommandsForKey(item.shortcut, keybindingMap);
			}
		});

		context.subscriptions.push(command);
		return command;
	});

	const treeViewCommands = [
		vscode.commands.registerCommand('echocode.toggleEnabled', (item: SoundTreeItem) => {
			soundTreeDataProvider.toggleShortcut(item.shortcut);
		}),
		vscode.commands.registerCommand('echocode.increaseVolume', (item: SoundTreeItem) => {
			soundTreeDataProvider.updateVolume(item.shortcut, item.config.volume + 0.1);
		}),
		vscode.commands.registerCommand('echocode.decreaseVolume', (item: SoundTreeItem) => {
			soundTreeDataProvider.updateVolume(item.shortcut, item.config.volume - 0.1);
		}),
		vscode.commands.registerCommand('echocode.changeSound', async (item: SoundTreeItem) => {
			if (!item) {return;}

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

			const rawData = fs.readFileSync(keybindingsPath, 'utf-8');
			let parsed: any[];
			try {
				parsed = JSON.parse(rawData);
			} catch (e) {
				vscode.window.showErrorMessage('❌ Erreur de parsing du fichier defaultKeybindings.json');
				console.error(e);
				{return;}
			}

			const allKeys = [...new Set(
				parsed
					.map(entry => entry.key)
					.filter((key: string | undefined) => typeof key === 'string' && key.trim() !== '')
			)].sort((a, b) => a.localeCompare(b, 'fr'));

			allKeys.push('✏️ Entrer manuellement...');

			const shortcutPick = await vscode.window.showQuickPick(allKeys, {
				placeHolder: 'Choisissez un raccourci clavier'
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
				f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg')
			);

			const soundFile = await vscode.window.showQuickPick(files, {
				placeHolder: 'Choisissez un fichier son'
			});

			if (!soundFile) {return;}

			const existing = soundTreeDataProvider.getShortcut(shortcut);
			if (existing) {
				if (existing.isVisible) {
					vscode.window.showWarningMessage(`🔁 Le raccourci "${shortcut}" existe déjà et est actif.`);
				} else {
					if (shortcut.toLowerCase() === 'ctrl+f') {
						vscode.window.showWarningMessage('❌ Impossible d\'assigner le raccourci "Ctrl+F".');
						return;
					}
					soundTreeDataProvider.toggleVisibility(shortcut);
					soundTreeDataProvider.updateSoundFile(shortcut, soundFile);
					vscode.window.showInformationMessage(`✅ Raccourci "${shortcut}" réactivé avec ${soundFile}`);
				}
			} else {
				soundTreeDataProvider.addShortcut(shortcut, {
					soundFile,
					enabled: true,
					isVisible: true,
					volume: 1.0
				});
				vscode.window.showInformationMessage(`✅ Nouveau raccourci ajouté : ${shortcut}`);
			}
		}),

		vscode.commands.registerCommand('echocode.removeShortcut', async (item: SoundTreeItem) => {
			if (!item) {return;}

			const confirm = await vscode.window.showWarningMessage(
				`Supprimer le raccourci "${item.shortcut}" ? (il sera masqué, pas supprimé du fichier)`,
				{ modal: true },
				'Oui'
			);

			if (confirm === 'Oui') {
				soundTreeDataProvider.toggleVisibility(item.shortcut);
				item.config.soundFile = EMPTY_SOUND; // Réinitialise le son
				vscode.window.showInformationMessage(`❌ Raccourci masqué : ${item.shortcut}`);
			}
		}),

		vscode.commands.registerCommand('echocode.playShortcutSound', (item: SoundTreeItem) => {
			if (!item) {return;}
			playSoundWebview(item.shortcut, item.config.soundFile, item.config.enabled, item.config.volume);
		})
	];

	const runSoundCommands = [
		vscode.commands.registerCommand('echocode.playRunSound', (item: RunSoundTreeItem2) => {
			playSoundWebview('', item.soundFile, item.enabled, item.volume);
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
			if (!item) {{return;}}

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

		if (!fileUri || fileUri.length === 0) {
			{return;}
		}

		const sourcePath = fileUri[0].fsPath;
		const fileName = path.basename(sourcePath);
		const destPath = path.join(context.extensionPath, 'media', fileName);

		// Vérifie l'existence du dossier media
		if (!fs.existsSync(path.dirname(destPath))) {
			fs.mkdirSync(path.dirname(destPath), { recursive: true });
		}

		// Copie du fichier
		try {
			fs.copyFileSync(sourcePath, destPath);
			vscode.window.showInformationMessage(`✅ Son "${fileName}" importé avec succès !`);

			// Si la WebView est ouverte, on l'informe d'un nouveau son
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
			playSoundWebview('', runSound.soundFile, runSound.enabled, runSound.volume);
		}
		event.terminal.show(false);
	});

	[...treeViewCommands, ...runSoundCommands].forEach(cmd => context.subscriptions.push(cmd));
}

export function deactivate() {}
