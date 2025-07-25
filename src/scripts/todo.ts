import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export type Task = {
  text: string;
  done: boolean;
  type: 'task' | 'title';
};

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

  const defaultEditable = context.asAbsolutePath(path.join('data', 'classicToDo.json'));
  const defaultReview = context.asAbsolutePath(path.join('data', 'reviewToDo.json'));

  fileMap.editable = path.join(baseDir, 'classicToDo.json');
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
  console.log(`[TODO] getTasks (mode: ${mode}) → ${tasks.length} élément(s)`);
  return tasks;
}

export function getMode(): TodoMode {
  return mode;
}

export function getFilePathForMode(m: TodoMode): string {
  return fileMap[m];
}

export function addTask(text: string, isTitle: boolean = false) {
  if (mode !== 'editable') {return;}

  const newTask: Task = { 
    text,
    done: false,
    type: isTitle ? 'title' : 'task'
  };

  tasks.push(newTask);
  console.log(`[TODO] ${isTitle ? 'Titre' : 'Tâche'} ajouté(e) : "${text}"`);
  saveTasksToFile();
}

export function toggleTask(index: number) {
  if (index >= 0 && index < tasks.length) {
    if (tasks[index].type === 'title') {return;}
    tasks[index].done = !tasks[index].done;
    console.log(`[TODO] Tâche togglée : [${index}] → ${tasks[index].done ? 'faite' : 'à faire'}`);
    saveTasksToFile();
  }
}

export function updateTask(index: number, text: string) {
  if (mode !== 'editable') {return;}
  if (index >= 0 && index < tasks.length) {
    tasks[index].text = text;
    saveTasksToFile();
  }
}

export function deleteTask(index: number) {
  if (mode !== 'editable') {return;}
  if (index >= 0 && index < tasks.length) {
    tasks.splice(index, 1);
    saveTasksToFile();
  }
}

export function moveTask(from: number, to: number) {
  if (mode !== 'editable') {return;}
  if (from < 0 || from >= tasks.length || to < 0 || to >= tasks.length) {return;}
  const [moved] = tasks.splice(from, 1);
  tasks.splice(to, 0, moved);
  saveTasksToFile();
}

export function setMode(newMode: TodoMode) {
  console.log(`[TODO] Changement de mode : ${mode} → ${newMode}`);
  mode = newMode;
  loadTasksFromFile();
}

/**
 * Charge un fichier texte et l'importe comme ToDo en mode review.
 * @param filePath chemin du fichier texte
 * @param useCustomFormat true si le fichier utilise le format custom (# titres, ||task||)
 */
export function loadReviewFromText(filePath: string, useCustomFormat = false) {
  if (!fs.existsSync(filePath)) {
    console.error(`[TODO] Fichier introuvable : ${filePath}`);
    throw new Error("Fichier texte introuvable");
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim() !== "");

  tasks = [];

  if (useCustomFormat) {
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        const title = trimmed.replace(/^#+\s*/, '').trim();
        tasks.push({ text: title, done: false, type: 'title' });
      } else if (trimmed.startsWith('||') && trimmed.endsWith('||')) {
        const task = trimmed.slice(2, -2).trim();
        tasks.push({ text: task, done: false, type: 'task' });
      }
    });
  } else {
    lines.forEach(line => {
      tasks.push({
        text: line.replace(/^[-*]\s*/, ''),
        done: false,
        type: 'task'
      });
    });
  }

  mode = 'review';
  console.log(`[TODO] Fichier texte chargé (${tasks.length} élément(s))`);
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
    console.log(`[TODO] ${tasks.length} élément(s) sauvegardé(s) dans : ${filePath}`);
  } catch (err) {
    console.error(`[TODO] Erreur lors de la sauvegarde des tâches :`, err);
  }
}
