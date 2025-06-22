import os
import time
import subprocess

# 1. Tuer tous les processus VS Code
os.system("taskkill /IM Code.exe /F")

print("Fermeture de VSCode")

# 2. Attendre un peu pour laisser le système respirer
time.sleep(2)

print("Ouverture de VSCode")

# 3. Redémarrer VS Code avec le même workspace (à adapter selon ton chemin)
vscode_path = "C:/Users/HP/AppData/Local/Programs/Microsoft VS Code/Code.exe"
workspace_path = "C:/Users/HP/Bureau/Memoire-Fantasia/EchoCode"

# 4. Lancer VS Code avec la workspace
subprocess.Popen([vscode_path, workspace_path])
