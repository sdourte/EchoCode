import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SoundTreeDataProvider, SoundTreeItem } from './tree/soundView';
import { RunSoundTreeDataProvider2, RunSoundTreeItem2 } from './tree/soundTerminal';
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
			console.log(`🔊 Son joué pour le raccourci "${shortcut}": ${soundFile} (Volume: ${volume})`);
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

	const soundTreeDataProvider = new SoundTreeDataProvider();
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

	const todoStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	todoStatusBarItem.text = '$(unmute) Ouvrir To-Do List';
	todoStatusBarItem.tooltip = 'Ouvrir To-Do List EchoCode';
	todoStatusBarItem.command = 'echocode.start';
	todoStatusBarItem.show();

	const EMPTY_SOUND = "empty.mp3";

	const mappingPath = path.join(context.extensionPath, 'src', 'data', 'nativeCommandMap.json');
	const rawMap = fs.readFileSync(mappingPath, 'utf-8');
	const nativeCommandMap: Record<string, string> = JSON.parse(rawMap);

	// --- Récupération des raccourcis visibles depuis la TreeView ---
	const shortcuts = soundTreeDataProvider.getAllShortcuts();
	console.log("SHORTCUTS LOADED:", shortcuts);

	// --- Enregistrement dynamique des commandes ---
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
			//const visible = config.isVisible;
			const enabled = config.enabled;
			const volume = config.volume ?? 1;

			// ▶️ Jouer un son
			playSoundWebview(item.shortcut, soundFile, enabled, volume);

			// 🎯 Exécuter la commande native correspondante
			const native = nativeCommandMap[commandId];
			if (native) {
				console.log(`🔄 Exécution commande native : ${native}`);
				await vscode.commands.executeCommand(native);
			} else {
				console.log(`⚠️ Aucune commande native associée pour ${commandId}`);
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
			const packagePath = path.join(context.extensionPath, 'package.json');

			if (!fs.existsSync(packagePath)) {
				vscode.window.showErrorMessage('❌ Fichier package.json introuvable.');
				return;
			}

			// Lecture des raccourcis autorisés depuis package.json
			let allowedShortcuts: string[] = [];
			try {
				const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
				if (packageData?.contributes?.keybindings) {
					allowedShortcuts = packageData.contributes.keybindings
						.map((kb: any) => kb.key)
						.filter((key: string | undefined) => typeof key === 'string' && key.trim() !== '')
						.sort((a: string, b: string) => a.localeCompare(b, 'fr'));
				}
			} catch (e) {
				vscode.window.showErrorMessage('❌ Erreur de parsing du package.json');
				console.error(e);
				return;
			}

			if (allowedShortcuts.length === 0) {
				vscode.window.showWarningMessage('⚠️ Aucun raccourci défini dans le package.json.');
				return;
			}

			// L'utilisateur choisit un raccourci parmi ceux autorisés
			const shortcut = await vscode.window.showQuickPick(allowedShortcuts, {
				placeHolder: 'Choisissez un raccourci clavier (défini dans le package.json)'
			});

			if (!shortcut) {return;}

			// Liste des fichiers sons
			const mediaFolder = path.join(context.extensionPath, 'media');
			const files = fs.readdirSync(mediaFolder).filter(f =>
				f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg')
			);

			const soundFile = await vscode.window.showQuickPick(files, {
				placeHolder: 'Choisissez un fichier son'
			});

			if (!soundFile) {return;}

			// Vérification si le raccourci existe déjà
			const existing = soundTreeDataProvider.getShortcut(shortcut);
			if (existing) {
				if (existing.isVisible) {
					vscode.window.showWarningMessage(`🔁 Le raccourci "${shortcut}" existe déjà et est actif.`);
				} else {
					soundTreeDataProvider.toggleVisibility(shortcut);
					soundTreeDataProvider.updateSoundFile(shortcut, soundFile);
					vscode.window.showInformationMessage(`✅ Raccourci "${shortcut}" activé avec ${soundFile}`);
				}
			} else {
				soundTreeDataProvider.addShortcut(shortcut, {
					soundFile,
					enabled: true,
					isVisible: true,
					volume: 1.0
				});
				vscode.window.showInformationMessage(`✅ Nouveau raccourci ajouté : ${shortcut}`);

				vscode.window.showInformationMessage(`Si le son vient d'être importé, cliquez sur la To-Do List pour l'activer.`);
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
					sound: fileName,
					mediaBaseUrl: soundWebviewPanel.webview.asWebviewUri(
						vscode.Uri.file(path.join(context.extensionPath, 'media'))
					).toString() + '/'
				});
			}
		} catch (err) {
			console.error(err);
			vscode.window.showErrorMessage("❌ Échec de l'import du son.");
		}
	});
	context.subscriptions.push(importSoundCommand);

	const runPythonWithSoundCommand = vscode.commands.registerCommand('echocode.runPythonWithSound', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage("Aucun fichier ouvert.");
			return;
		}

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
				if (e.exitCode === 0) {
					vscode.window.showInformationMessage("Script terminé avec succès !");
					playSoundWebview('', 'success.mp3', true, 1.0);
				} else {
					vscode.window.showErrorMessage("Erreur lors de l'exécution du script.");
					playSoundWebview('', 'error.mp3', true, 1.0);
				}
				disposable.dispose();
			}
		});

		vscode.tasks.executeTask(task);
	});

	context.subscriptions.push(runPythonWithSoundCommand);



	[...treeViewCommands, ...runSoundCommands].forEach(cmd => context.subscriptions.push(cmd));
}

export function deactivate() {}
