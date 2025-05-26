import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SoundTreeDataProvider, SoundTreeItem } from './tree/soundView';
import { RunSoundTreeDataProvider2, RunSoundTreeItem2, RunSoundType } from './tree/soundTerminal';
import { exec } from 'child_process';
import { buildKeybindingMap, runDefaultCommandsForKey } from './scripts/keybindingMapper';

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
	const shortcuts = new SoundTreeDataProvider().getAllShortcuts();
	for (const s of shortcuts) {
		if (s.soundFile) { allSounds.add(s.soundFile); }
	}
	soundWebviewPanel.webview.postMessage({
		type: "init",
		preloadSounds: Array.from(allSounds)
	});

	soundWebviewPanel.onDidDispose(() => {
		soundWebviewPanel = undefined;
	});
}

function playSoundWebview(soundFile: string, enabled: boolean, volume: number) {
	if (soundWebviewPanel) {
		if (enabled) {
			soundWebviewPanel.webview.postMessage({ sound: soundFile, enabled, volume });
		} else {
			vscode.window.showWarningMessage(`⛔ Le son "${soundFile}" est désactivé.`);
		}
	}
}

export async function activate(context: vscode.ExtensionContext) {
	console.log('EchoCode activé !');

	const startDisposable = vscode.commands.registerCommand('echocode.start', () => {
		vscode.window.showInformationMessage('Starting EchoCode!');
		createOrShowSoundWebView(context);
	});
	context.subscriptions.push(startDisposable);

	vscode.commands.executeCommand('echocode.start');

	// === SHORTCUTS TREE ===
	const soundTreeDataProvider = new SoundTreeDataProvider();
	vscode.window.registerTreeDataProvider('soundExplorer', soundTreeDataProvider);

	// === RUN TREE ===
	const runSoundProvider = new RunSoundTreeDataProvider2();
	vscode.window.registerTreeDataProvider('runSounds', runSoundProvider);

	// === SHORTCUT COMMANDS ===
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
			await runDefaultCommandsForKey(item.shortcut, keybindingMap);
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

	// === TERMINAL LOGIC ===
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

	// Enregistrement global
	[...treeViewCommands, ...runSoundCommands].forEach(cmd => context.subscriptions.push(cmd));
}

export function deactivate() {}
