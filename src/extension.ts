// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SoundTreeDataProvider, SoundTreeItem } from './tree/soundView';
import { exec } from 'child_process';
import { buildKeybindingMap, runDefaultCommandsForKey } from './scripts/keybindingMapper';

let soundWebviewPanel: vscode.WebviewPanel | undefined;

function updateKeybindings(context: vscode.ExtensionContext) {
	// Chemin absolu vers le dossier de l'extension
	const extensionRoot = context.extensionPath;

	// Commande à exécuter : lancer ton script via npm run update:keybindings
	const command = 'npm run update:keybindings';

	// Exécute la commande dans le dossier de l'extension
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

	// 🔁 Envoi de la liste des sons à précharger une fois
	const allSounds = new Set<string>();
	const shortcuts = new SoundTreeDataProvider().getAllShortcuts();
	for (const s of shortcuts) {
		if (s.soundFile) {allSounds.add(s.soundFile);}
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
		}
		else {
			vscode.window.showWarningMessage(`⛔ Le raccourci "${soundFile}" est désactivé.`);
		}
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

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

	context.subscriptions.push(disposable);

	// Start the extension when it is activated
	vscode.commands.executeCommand('echocode.start');

	// Create the DataProvider for the tree view
	const soundTreeDataProvider = new SoundTreeDataProvider();
	vscode.window.registerTreeDataProvider('soundExplorer', soundTreeDataProvider);

	// Dynamically register a command for each shortcut found in shortcuts.json
	const shortcuts = soundTreeDataProvider.getAllShortcuts();
	// Build the keybinding map
	const keybindingMap = await buildKeybindingMap();
	console.log('Keybinding map:', keybindingMap);
	const dynamicShortcutCommands = shortcuts.map((item) => {
		const normalized = item.shortcut
			.replace(/\+/g, '')
			.replace(/\s/g, '')
			.replace(/-/g, '')
			.replace(/[^a-zA-Z0-9]/g, '');

		const commandId = `echocode.print${normalized}`;

		console.log(`Registering command: ${commandId}`);

		const command = vscode.commands.registerCommand(commandId, async () => {

			vscode.window.showInformationMessage(`🎵 ${item.shortcut} → ${item.soundFile}`);
			playSoundWebview(item.soundFile, item.enabled, item.volume);
			// Add default commands for the keybinding
			await runDefaultCommandsForKey(item.shortcut, keybindingMap);
		});

		context.subscriptions.push(command); // Ajout au contexte ici directement
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
				vscode.window.showInformationMessage(`Raccourci ajouté : ${shortcut}`);
			}
			updateKeybindings(context);
			await new Promise(resolve => setTimeout(resolve, 10000));
			// Recharger la fenêtre pour que les raccourcis soient à jour
			if (soundWebviewPanel) {
				vscode.window.showInformationMessage('Fermeture de la WebView');
				soundWebviewPanel.dispose(); // Ferme explicitement la WebView
			}
			await vscode.commands.executeCommand('workbench.action.reloadWindow');

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

				updateKeybindings(context);
				await new Promise(resolve => setTimeout(resolve, 6000));
				// Recharger la fenêtre pour que les raccourcis soient à jour
				if (soundWebviewPanel) {
					vscode.window.showInformationMessage('Fermeture de la WebView');
					soundWebviewPanel.dispose(); // Ferme explicitement la WebView
				}
				await vscode.commands.executeCommand('workbench.action.reloadWindow');

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

	// Suivi des terminaux EchoCode (simples)
	const pythonTerminalMap = new Map<vscode.Terminal, boolean>();

	vscode.window.onDidEndTerminalShellExecution((event) => {
		console.log(`✅ Fin de l'exécution dans : ${event.terminal.name}`);
		pythonTerminalMap.delete(event.terminal);

		// Vérifie si l'exécution s'est terminée avec succès
		const exitCode = event.exitCode;
		const success = exitCode === 0;

		console.log(`ℹ️ Code de sortie : ${exitCode} → ${success ? 'succès' : 'erreur'}`);

		// Sélectionne le son approprié
		const shortcut = soundTreeDataProvider.getShortcut(success ? 'RunSuccess' : 'RunError');
		if (shortcut?.enabled) {
			console.log(`🔊 Lecture de : ${shortcut.soundFile}`);
			playSoundWebview(shortcut.soundFile, shortcut.enabled, shortcut.volume);
		}
	});

	// All the commands added to the command palette
	const commands = [
		...treeViewCommands,
	];

	for (const command of commands) {
		context.subscriptions.push(command);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
