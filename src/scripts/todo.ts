import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export type Task = { text: string; done: boolean };
export type TodoMode = 'editable' | 'review';

let tasks: Task[] = [];
let mode: TodoMode = 'editable';
let baseDir: string;
const fileMap: Record<TodoMode, string> = {
  editable: '',
  review: ''
};

export function initializeTodo(context: vscode.ExtensionContext) {
  baseDir = context.globalStorageUri.fsPath;
  console.log(`[TODO] Initialisation... Stockage dans : ${baseDir}`);

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
    console.log(`[TODO] Dossier de stockage créé.`);
  }

  fileMap.editable = path.join(baseDir, 'classicToDo.json');  // ✅ Utiliser globalStorage
  fileMap.review = path.join(baseDir, 'reviewToDo.json');

  ensureFileExists('editable');
  ensureFileExists('review');

  setMode('editable');
}

function ensureFileExists(mode: TodoMode) {
  const file = fileMap[mode];
  if (!fs.existsSync(file)) {
    const defaultData = { tasks: [] };
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2), 'utf-8');
    console.log(`[TODO] Fichier ${mode} créé vide.`);
  } else {
    console.log(`[TODO] Fichier ${mode} déjà présent.`);
  }
}

export function getTasks(): Task[] {
  console.log(`[TODO] getTasks (mode: ${mode}) → ${tasks.length} tâche(s)`);
  return tasks;
}

export function getMode(): TodoMode {
  console.log(`[TODO] getMode → ${mode}`);
  return mode;
}

export function getFilePathForMode(m: TodoMode): string {
  return fileMap[m];
}

export function addTask(text: string) {
  if (mode !== 'editable') {
    console.warn(`[TODO] addTask ignoré, mode actuel : ${mode}`);
    return;
  }
  tasks.push({ text, done: false });
  console.log(`[TODO] Tâche ajoutée : "${text}"`);
  saveTasksToFile();
}

export function toggleTask(index: number) {
    console.log(`[TODO] toggleTask appelé !`);
  if (index >= 0 && index < tasks.length) {
    tasks[index].done = !tasks[index].done;
    console.log(`[TODO] Tâche togglée (mode: ${mode}) : [${index}] → ${tasks[index].done ? 'faite' : 'à faire'}`);
    saveTasksToFile();
  } else {
    console.warn(`[TODO] toggleTask : index ${index} invalide.`);
  }
}

export function setMode(newMode: TodoMode) {
  console.log(`[TODO] Changement de mode : ${mode} → ${newMode}`);
  mode = newMode;
  loadTasksFromFile();
}

export function loadReviewFromText(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.error(`[TODO] Fichier de review introuvable : ${filePath}`);
    throw new Error("Fichier texte introuvable");
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(line => line.trim().length > 0);

  tasks = lines.map(line => ({ text: line.replace(/^[-*]\s*/, ''), done: false }));
  mode = 'review';

  console.log(`[TODO] Fichier texte chargé (${lines.length} tâche(s))`);
  saveTasksToFile();
}

function loadTasksFromFile() {
  const filePath = fileMap[mode];
  console.log(`[TODO] Chargement des tâches depuis : ${filePath}`);

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      tasks = parsed.tasks || [];
      console.log(`[TODO] ${tasks.length} tâche(s) chargée(s) pour le mode "${mode}".`);
    } catch (err) {
      console.error(`[TODO] Erreur de parsing JSON :`, err);
      tasks = [];
    }
  } else {
    console.warn(`[TODO] Fichier non trouvé pour ${mode}, initialisation vide.`);
    tasks = [];
  }
}

function saveTasksToFile() {
  const filePath = fileMap[mode];
  try {
    fs.writeFileSync(filePath, JSON.stringify({ tasks }, null, 2), 'utf-8');
    console.log(`[TODO] ${tasks.length} tâche(s) sauvegardée(s) dans : ${filePath}`);
  } catch (err) {
    console.error(`[TODO] Erreur lors de la sauvegarde des tâches :`, err);
  }
}
