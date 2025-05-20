// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "echocode" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('echocode.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from EchoCode!');
	});

	const printCtrlC = vscode.commands.registerCommand('echocode.printCtrlC', () => {
		vscode.window.showInformationMessage('CTRL+C');
	});
	const printCtrlV = vscode.commands.registerCommand('echocode.printCtrlV', () => {
		vscode.window.showInformationMessage('CTRL+V');
	});
	const printCtrlS = vscode.commands.registerCommand('echocode.printCtrlS', () => {
		vscode.window.showInformationMessage('CTRL+S');
	});
	const printCtrlZ = vscode.commands.registerCommand('echocode.printCtrlZ', () => {
		vscode.window.showInformationMessage('CTRL+Z');
	});
	const printCtrlY = vscode.commands.registerCommand('echocode.printCtrlY', () => {
		vscode.window.showInformationMessage('CTRL+Y');
	});

	// All the commands added to the command palette
	const commands = [
		disposable,
		printCtrlC,
		printCtrlV,
		printCtrlS,
		printCtrlZ,
		printCtrlY
		];

	for (const command of commands) {
		context.subscriptions.push(command);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
