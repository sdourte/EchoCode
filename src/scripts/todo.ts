import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export type Task = { text: string; done: boolean };
export type TodoMode = 'editable' | 'review';

let tasks: Task[] = [];
let mode: TodoMode = 'editable';
let todoFilePath: string;

export function initializeTodo(context: vscode.ExtensionContext) {
  const storageDir = context.globalStorageUri.fsPath;
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  todoFilePath = path.join(storageDir, 'todo.json');
  loadTasksFromFile();
}

export function getTasks() {
  return tasks;
}

export function getMode() {
  return mode;
}

export function addTask(text: string) {
  tasks.push({ text, done: false });
  saveTasksToFile();
}

export function toggleTask(index: number) {
  if (index >= 0 && index < tasks.length) {
    tasks[index].done = !tasks[index].done;
    saveTasksToFile();
  }
}

function loadTasksFromFile() {
  if (fs.existsSync(todoFilePath)) {
    try {
      const content = fs.readFileSync(todoFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      tasks = parsed.tasks || [];
      mode = parsed.mode || 'editable';
    } catch (err) {
      console.error("Erreur lors du chargement des tâches :", err);
      tasks = [];
      mode = 'editable';
    }
  }
}

function saveTasksToFile() {
  try {
    fs.writeFileSync(todoFilePath, JSON.stringify({
      tasks,
      mode
    }, null, 2), 'utf-8');
  } catch (err) {
    console.error("Erreur lors de la sauvegarde des tâches :", err);
  }
}
