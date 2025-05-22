// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SoundTreeDataProvider, SoundTreeItem } from './tree/soundView';

let soundWebviewPanel: vscode.WebviewPanel | undefined;

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

	soundWebviewPanel.onDidDispose(() => {
		soundWebviewPanel = undefined;
	});
}

function playSoundWebview(soundFile: string, enabled: boolean, volume: number) {
	if (soundWebviewPanel) {
		if (enabled) {
			soundWebviewPanel.webview.postMessage({ sound: soundFile, enabled, volume });
		}
		else {
			vscode.window.showWarningMessage(`⛔ Le raccourci "${soundFile}" est désactivé.`);
		}
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "echocode" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('echocode.start', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Starting EchoCode!');
		createOrShowSoundWebView(context);
	});

	// Create the DataProvider for the tree view
	const soundTreeDataProvider = new SoundTreeDataProvider();
	vscode.window.registerTreeDataProvider('soundExplorer', soundTreeDataProvider);

	const shortcutsCommands = [
		vscode.commands.registerCommand('echocode.printCtrlC', () => {
			const item = soundTreeDataProvider.getShortcut('Ctrl+C');
			if (item) {
				vscode.window.showInformationMessage('CTRL+C');
				playSoundWebview(item.soundFile, item.enabled, item.volume);
			} else {
				vscode.window.showErrorMessage('Shortcut "Ctrl+C" not found.');
			}
		}),

		vscode.commands.registerCommand('echocode.printCtrlV', () => {
			const item = soundTreeDataProvider.getShortcut('Ctrl+V');
			if (item) {
				vscode.window.showInformationMessage('CTRL+V');
				playSoundWebview(item.soundFile, item.enabled, item.volume);
			} else {
				vscode.window.showErrorMessage('Shortcut "Ctrl+V" not found.');
			}
		}),

		vscode.commands.registerCommand('echocode.printCtrlS', () => {
			const item = soundTreeDataProvider.getShortcut('Ctrl+S');
			if (item) {
				vscode.window.showInformationMessage('CTRL+S');
				playSoundWebview(item.soundFile, item.enabled, item.volume);
			} else {
				vscode.window.showErrorMessage('Shortcut "Ctrl+S" not found.');
			}
		}),

		vscode.commands.registerCommand('echocode.printCtrlZ', () => {
			const item = soundTreeDataProvider.getShortcut('Ctrl+Z');
			if (item) {
				vscode.window.showInformationMessage('CTRL+Z');
				playSoundWebview(item.soundFile, item.enabled, item.volume);
			} else {
				vscode.window.showErrorMessage('Shortcut "Ctrl+Z" not found.');
			}
		}),

		vscode.commands.registerCommand('echocode.printCtrlY', () => {
			const item = soundTreeDataProvider.getShortcut('Ctrl+Y');
			if (item) {
				vscode.window.showInformationMessage('CTRL+Y');
				playSoundWebview(item.soundFile, item.enabled, item.volume);
			} else {
				vscode.window.showErrorMessage('Shortcut "Ctrl+Y" not found.');
			}
		}),
	];

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
				prompt: 'Nouveau nom de fichier son (ex: beep.mp3)',
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
			}
		}),

		vscode.commands.registerCommand('echocode.removeShortcut', async (item: SoundTreeItem) => {
			if (!item) {return;}

			const confirm = await vscode.window.showWarningMessage(
				`Voulez-vous supprimer le raccourci "${item.shortcut}" ?`,
				{ modal: true },
				'Oui'
			);

			if (confirm === 'Oui') {
				soundTreeDataProvider.removeShortcut(item.shortcut);
				vscode.window.showInformationMessage(`Raccourci supprimé : ${item.shortcut}`);
			}
		}),

		vscode.commands.registerCommand('echocode.playShortcutSound', (item: SoundTreeItem) => {
			if (!item) {
				vscode.window.showErrorMessage('Aucun élément sélectionné.');
				return;
			}
			vscode.window.showInformationMessage(`🎵 ${item.shortcut} → ${item.soundFile}`);
			playSoundWebview(item.soundFile, item.enabled, item.volume); // Si tu utilises la WebView pour jouer
		}),
	];
	// All the commands added to the command palette
	const commands = [
		disposable,
		...shortcutsCommands,
		...treeViewCommands
		];

	for (const command of commands) {
		context.subscriptions.push(command);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
