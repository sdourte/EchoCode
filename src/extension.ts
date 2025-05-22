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

function playSoundWebview(sound: string) {
	if (soundWebviewPanel) {
		soundWebviewPanel.webview.postMessage({ sound });
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

	const printCtrlC = vscode.commands.registerCommand('echocode.printCtrlC', () => {
		vscode.window.showInformationMessage('CTRL+C');
		playSoundWebview('ctrlC.mp3');
	});
	const printCtrlV = vscode.commands.registerCommand('echocode.printCtrlV', () => {
		vscode.window.showInformationMessage('CTRL+V');
		playSoundWebview('ctrlV.mp3');
	});
	const printCtrlS = vscode.commands.registerCommand('echocode.printCtrlS', () => {
		vscode.window.showInformationMessage('CTRL+S');
		playSoundWebview('ctrlS.mp3');
	});
	const printCtrlZ = vscode.commands.registerCommand('echocode.printCtrlZ', () => {
		vscode.window.showInformationMessage('CTRL+Z');
		playSoundWebview('ctrlZ.mp3');
	});
	const printCtrlY = vscode.commands.registerCommand('echocode.printCtrlY', () => {
		vscode.window.showInformationMessage('CTRL+Y');
		playSoundWebview('ctrlY.mp3');
	});

	const soundTreeDataProvider = new SoundTreeDataProvider();
	vscode.window.registerTreeDataProvider('soundExplorer', soundTreeDataProvider);

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
			vscode.window.showInformationMessage(`🎵 ${item.shortcut} → ${item.soundFile}`);
			playSoundWebview(item.soundFile); // Si tu utilises la WebView pour jouer
		}),
	];
	// All the commands added to the command palette
	const commands = [
		disposable,
		printCtrlC,
		printCtrlV,
		printCtrlS,
		printCtrlZ,
		printCtrlY,
		...treeViewCommands
		];

	for (const command of commands) {
		context.subscriptions.push(command);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
