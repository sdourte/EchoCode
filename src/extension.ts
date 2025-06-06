import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SoundTreeDataProvider, SoundTreeItem } from './tree/soundView';
import { RunSoundTreeDataProvider2, RunSoundTreeItem2, RunSoundType } from './tree/soundTerminal';
import { exec } from 'child_process';
import { buildKeybindingMap, runDefaultCommandsForKey } from './scripts/keybindingMapper';
import { initializeTodo, getTasks, getMode, addTask, toggleTask, updateTask, moveTask, deleteTask, setMode } from './scripts/todo';

let soundWebviewPanel: vscode.WebviewPanel | undefined;

function updateKeybindings(context: vscode.ExtensionContext) {
	const extensionRoot = context.extensionPath;
	const command = 'npm run update:keybindings';
	exec(command, { cwd: extensionRoot }, (error, stdout, stderr) => {
		if (error) {
			console.error(`Erreur lors de la génération des keybindings : ${error.message}`);
			vscode.window.showErrorMessage(`Erreur lors de la génération des keybindings : ${error.message}`);
			return;
		}
		if (stderr) {
			console.warn(`Warnings lors de la génération des keybindings : ${stderr}`);
		}
		console.log(`Keybindings générés : ${stdout}`);
		vscode.window.showInformationMessage('Keybindings mis à jour avec succès !');		
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
		return;
	}

	soundWebviewPanel = vscode.window.createWebviewPanel(
		'echocodeSoundPlayer',
		'Sound Player',
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
				if (getMode() === 'editable') {
					addTask(message.text);
					soundWebviewPanel?.webview.postMessage({
						type: 'updateTasks',
						tasks: getTasks(),
						mode: getMode()
					});
				}
				break;

			case 'toggleTask':
				toggleTask(message.index);  // Pas de condition ici
				soundWebviewPanel?.webview.postMessage({
					type: 'updateTasks',
					tasks: getTasks(),
					mode: getMode()
				});
				break;

			case 'switchMode':
				const newMode = getMode() === 'editable' ? 'review' : 'editable';
				setMode(newMode);
				soundWebviewPanel?.webview.postMessage({
					type: 'updateTasks',
					tasks: getTasks(),
					mode: getMode()
				});
				break;
			
			case 'updateTask':
				if (getMode() === 'editable') {
					updateTask(message.index, message.text);
					soundWebviewPanel?.webview.postMessage({
						type: 'updateTasks',
						tasks: getTasks(),
						mode: getMode()
					});
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

		}
	});
}

function playSoundWebview(soundFile: string, enabled: boolean, volume: number) {
	if (soundWebviewPanel) {
		if (enabled) {
			soundWebviewPanel.webview.postMessage({ sound: soundFile, enabled, volume });
		} else {
			vscode.window.showWarningMessage(`⛔ Le son \"${soundFile}\" est désactivé.`);
		}
	}
}

export async function activate(context: vscode.ExtensionContext) {
	console.log('EchoCode activé !');

	initializeTodo(context);

	const startDisposable = vscode.commands.registerCommand('echocode.start', () => {
		vscode.window.showInformationMessage('Starting EchoCode!');
		createOrShowSoundWebView(context);
	});
	context.subscriptions.push(startDisposable);

	vscode.commands.executeCommand('echocode.start');

	const soundTreeDataProvider = new SoundTreeDataProvider();
	vscode.window.registerTreeDataProvider('soundExplorer', soundTreeDataProvider);

	const runSoundProvider = new RunSoundTreeDataProvider2();
	vscode.window.registerTreeDataProvider('runSounds', runSoundProvider);

	const shortcuts = soundTreeDataProvider.getAllShortcuts();
	const keybindingMap = await buildKeybindingMap();

	const dynamicShortcutCommands = shortcuts.map((item) => {
		const normalized = item.shortcut
			.replace(/\+/g, '')
			.replace(/\s/g, '')
			.replace(/-/g, '')
			.replace(/[^a-zA-Z0-9]/g, '');

		const commandId = `echocode.print${normalized}`;

		const command = vscode.commands.registerCommand(commandId, async () => {
			vscode.window.showInformationMessage(`🎵 ${item.shortcut} → ${item.soundFile}`);
			playSoundWebview(item.soundFile, item.enabled, item.volume);

			const shortcut = item.shortcut.toLowerCase().trim();
			const editorCommand = keybindingMap[shortcut]?.find(cmd => cmd.includes("editor"));

			if (editorCommand) {
				console.log(`Commande liée à l'éditeur trouvée pour ${shortcut} : ${editorCommand}`);
				await vscode.commands.executeCommand(editorCommand);
			} else {
				console.log(`Aucune commande liée à l'éditeur trouvée pour ${shortcut}, fallback général.`);
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
			soundTreeDataProvider.updateVolume(item.shortcut, item.volume + 0.1);
		}),
		vscode.commands.registerCommand('echocode.decreaseVolume', (item: SoundTreeItem) => {
			soundTreeDataProvider.updateVolume(item.shortcut, item.volume - 0.1);
		}),
		vscode.commands.registerCommand('echocode.changeSound', async (item: SoundTreeItem) => {
			const newFile = await vscode.window.showInputBox({
				prompt: 'Nouveau fichier son (ex: beep.mp3)',
				value: item.soundFile
			});
			if (newFile) {
				soundTreeDataProvider.updateSoundFile(item.shortcut, newFile);
			}
		}),
		vscode.commands.registerCommand('echocode.addShortcut', async () => {
			const shortcut = await vscode.window.showInputBox({ prompt: 'Raccourci (ex: Ctrl+Alt+M)' });
			const soundFile = await vscode.window.showInputBox({ prompt: 'Nom du fichier son (ex: magic.mp3)' });
			if (shortcut && soundFile) {
				soundTreeDataProvider.addShortcut({ shortcut, soundFile, enabled: true, volume: 1 });
				vscode.window.showInformationMessage(`Raccourci ajouté : ${shortcut}`);
			}
			updateKeybindings(context);
			await new Promise(resolve => setTimeout(resolve, 10000));
			if (soundWebviewPanel) {
				vscode.window.showInformationMessage('Fermeture de la WebView');
				soundWebviewPanel.dispose();
			}
			await vscode.commands.executeCommand('workbench.action.reloadWindow');
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
				vscode.window.showInformationMessage(`Raccourci supprimé : ${item.shortcut}`);
				updateKeybindings(context);
				await new Promise(resolve => setTimeout(resolve, 6000));
				if (soundWebviewPanel) {
					soundWebviewPanel.dispose();
				}
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
			const newFile = await vscode.window.showInputBox({
				prompt: 'Nouveau fichier son pour ce type de run',
				value: item.soundFile
			});
			if (newFile) {
				runSoundProvider.updateSoundFile(item.type, newFile);
			}
		})
	];

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
