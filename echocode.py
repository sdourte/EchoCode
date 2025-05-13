import keyboard
import pygame
import os
import json
import time
import sys
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

CONFIG_FILE = "settings.json"
SOUND_FOLDER = "sounds"

class EchoCodeListener:
    def __init__(self):
        # Mapping raccourcis -> fichiers sons
        self.sound_map = {
            'ctrl+c': os.path.join(SOUND_FOLDER, 'copy.mp3'),
            'ctrl+v': os.path.join(SOUND_FOLDER, 'paste.mp3'),
            'ctrl+z': os.path.join(SOUND_FOLDER, 'undo.mp3'),
            'ctrl+y': os.path.join(SOUND_FOLDER, 'redo.mp3'),
            'ctrl+s': os.path.join(SOUND_FOLDER, 'save.mp3')
        }

        # Mapping raccourcis -> clés de config
        self.shortcut_config_keys = {
            'ctrl+c': 'sound_copy',
            'ctrl+v': 'sound_paste',
            'ctrl+z': 'sound_undo',
            'ctrl+y': 'sound_redo',
            'ctrl+s': 'sound_save'
        }

        self.shortcut_state = {key: False for key in self.sound_map}
        self.config = self.load_config()
        pygame.mixer.init()
        print("EchoCodeListener prêt.")

    def load_config(self):
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        return {}

    def reload_config(self):
        print("Configuration mise à jour")
        self.config = self.load_config()
        
    def play_sound(self, file):
        if os.path.exists(file):
            print(f"Lecture du son : {file}")
            pygame.mixer.Sound(file).play()
            time.sleep(2)  # Laisser le temps au son de jouer (utile pour les appels directs)
        else:
            print(f"Fichier manquant : {file}")
        
    def handle_shortcuts(self):
        while True:
            for shortcut in self.sound_map:
                if keyboard.is_pressed(shortcut):
                    if not self.shortcut_state[shortcut]:
                        config_key = self.shortcut_config_keys.get(shortcut)
                        if config_key and self.config.get(config_key, False):
                            print(f"{shortcut.upper()} détecté")
                            self.play_sound(self.sound_map[shortcut])
                        else:
                            print(f"{shortcut.upper()} ignoré (désactivé dans la config)")
                        self.shortcut_state[shortcut] = True
                else:
                    self.shortcut_state[shortcut] = False
            time.sleep(0.05)

class ConfigWatcher(FileSystemEventHandler):
    def __init__(self, listener: EchoCodeListener):
        self.listener = listener

    def on_modified(self, event):
        if event.src_path.endswith(CONFIG_FILE):
            self.listener.reload_config()

def main():
    listener = EchoCodeListener()

    # Mode "commande directe"
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == "success":
            script_dir = os.path.dirname(os.path.abspath(__file__))  # <-- le vrai dossier du script
            success_file = os.path.join(script_dir, SOUND_FOLDER, 'success.mp3')
            listener.play_sound(success_file)
        else:
            print(f"Commande inconnue : {command}")
        return

    # Mode écoute des raccourcis
    observer = Observer()
    observer.schedule(ConfigWatcher(listener), ".", recursive=False)
    observer.start()

    try:
        listener.handle_shortcuts()
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
    pygame.quit()

if __name__ == "__main__":
    main()
