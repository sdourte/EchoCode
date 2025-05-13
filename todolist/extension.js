const vscode = require('vscode');
const path = require('path');
const { exec } = require('child_process'); // Utilisation de 'exec' pour exécuter un script externe
const fs = require('fs');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

  const disposable = vscode.commands.registerCommand("echoTodo.openTodo", () => {
    const panel = vscode.window.createWebviewPanel(
      "echoTodo",
      "Echo To-Do",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
      }
    );

    const htmlPath = path.join(context.extensionPath, "media", "webview.html");
    const htmlContent = fs.readFileSync(htmlPath, "utf8");
    panel.webview.html = htmlContent;

    // Gestion des messages envoyés depuis le WebView (quand une tâche est marquée comme terminée)
    panel.webview.onDidReceiveMessage(message => {
      if (message.command === "taskCompleted") {
        vscode.window.showInformationMessage(`🏆 Tâche accomplie : "${message.task}"`);

        // Appel au script Python pour jouer le son
        playSoundWithPython('success');
      }
    });
  });

  context.subscriptions.push(disposable);
}

function playSoundWithPython(soundFile) {
  // Le chemin du script Python, relatif à l'emplacement de l'extension dans le dossier 'todolist'
  //const pythonScriptPath = path.join(__dirname, "echocode.py");

 // const command = `python "${pythonScriptPath}" play_sound "${soundFile}"`;

  // Chemin absolu vers le script Python
  const scriptPath = "C:/Users/HP/Bureau/Memoire-Fantasia/EchoCode/echocode.py";

  // Commande à exécuter
  const command = `python "${scriptPath}" ${soundFile}`;

  console.log("Début exec...");

  // Utilisation de 'exec' pour appeler le script Python avec les arguments
  exec(command, (err, stdout, stderr) => {

    console.log("Exécution du script Python pour jouer le son...");

    if (err) {
      console.error("Erreur lors de l'exécution du script Python:", err);
      return;
    }
    if (stderr) {
      console.error("Erreur dans le script Python:", stderr);
      return;
    }
    console.log("Script Python exécuté avec succès:", stdout);
  });
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
}
