import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SoundTreeDataProvider, SoundTreeItem } from './tree/soundView';
import { RunSoundTreeDataProvider2, RunSoundTreeItem2, RunSoundType } from './tree/soundTerminal';
import { buildKeybindingMap } from './scripts/keybindingMapper';
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
		}
	});
}

function playSoundWebview(soundFile: string, enabled: boolean, volume: number) {
	if (soundWebviewPanel) {
		if (enabled) {
			soundWebviewPanel.webview.postMessage({ sound: soundFile, enabled, volume });
		} else {
			vscode.window.showWarningMessage(`Le son "${soundFile}" est désactivé.`);
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

	await buildKeybindingMap();

	['slot1', 'slot2', 'slot3', 'slot4', 'slot5'].forEach((slotId) => {
		const commandId = `echocode.${slotId}`;
		const disposable = vscode.commands.registerCommand(commandId, () => {
			const shortcut = soundTreeDataProvider.getSlotConfig(slotId);
			if (shortcut && shortcut.soundFile) {
				playSoundWebview(shortcut.soundFile, shortcut.enabled, shortcut.volume);
			} else {
				vscode.window.showWarningMessage(`🔕 Aucun son configuré pour le raccourci "${slotId}"`);
			}
		});
		context.subscriptions.push(disposable);
	});

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
			if (!item) {return;}
			const mediaFolder = path.join(context.extensionPath, 'media');
			const files = fs.readdirSync(mediaFolder).filter(f => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg'));
			const selected = await vscode.window.showQuickPick(files, { placeHolder: 'Choisissez un nouveau son' });
			if (selected) {
				soundTreeDataProvider.updateSoundFile(item.shortcut, selected);
			}
		}),
		vscode.commands.registerCommand('echocode.addShortcut', async () => {
			const availableSlots = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5'];
			const slot = await vscode.window.showQuickPick(availableSlots, { placeHolder: 'Sélectionnez un slot à configurer' });
			if (!slot) {return;}
			const mediaFolder = path.join(context.extensionPath, 'media');
			const files = fs.readdirSync(mediaFolder).filter(f => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg'));
			const soundFile = await vscode.window.showQuickPick(files, { placeHolder: 'Choisissez un fichier son' });
			if (!soundFile) {return;}
			soundTreeDataProvider.updateSlot(slot, { soundFile, enabled: true, volume: 1 });
			vscode.window.showInformationMessage(`✅ Slot "${slot}" configuré avec "${soundFile}"`);
		}),
		vscode.commands.registerCommand('echocode.removeShortcut', async (item: SoundTreeItem) => {
			if (!item) {return;}
			const confirm = await vscode.window.showWarningMessage(`Supprimer le raccourci "${item.shortcut}" ?`, { modal: true }, 'Oui');
			if (confirm === 'Oui') {
				soundTreeDataProvider.updateSlot(item.shortcut, undefined as any);
				vscode.window.showInformationMessage(`❌ Raccourci supprimé : ${item.shortcut}`);
				if (soundWebviewPanel) {
					soundWebviewPanel.dispose();
				}
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
			const selected = await vscode.window.showQuickPick(files, { placeHolder: 'Choisissez un nouveau son' });
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
				soundWebviewPanel.webview.postMessage({ type: 'newSoundImported', sound: fileName });
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

export function deactivate() {}
