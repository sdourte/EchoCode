import os
import json
import pygame
import keyboard
import time

CONFIG_FILE = "settings.json"

class EchoCodeListener:
    def __init__(self):
        self.config = self.load_config()
        pygame.mixer.init()
        self.sound_folder = 'sounds'

        self.sound_map = {
            'ctrl+c': ('copy.mp3', 'sound_copy'),
            'ctrl+v': ('paste.mp3', 'sound_paste'),
            'ctrl+z': ('undo.mp3', 'sound_undo'),
            'ctrl+y': ('redo.mp3', 'sound_redo'),
        }

        self.shortcut_state = {shortcut: False for shortcut in self.sound_map}

    def load_config(self):
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f)
        return {}

    def play_sound(self, filename):
        path = os.path.join(self.sound_folder, filename)
        if os.path.exists(path):
            sound = pygame.mixer.Sound(path)
            sound.play()
        else:
            print(f"⚠️ Fichier introuvable : {path}")

    def listen(self):
        print("🎧 Écoute des raccourcis clavier...")

        try:
            while True:
                for shortcut, (file, config_key) in self.sound_map.items():
                    if self.config.get(config_key, False):
                        if keyboard.is_pressed(shortcut):
                            if not self.shortcut_state[shortcut]:
                                print(f"✅ {shortcut.upper()} détecté")
                                self.play_sound(file)
                                self.shortcut_state[shortcut] = True
                        else:
                            self.shortcut_state[shortcut] = False

                time.sleep(0.05)  # allège le CPU
        except KeyboardInterrupt:
            print("\n🛑 Arrêt manuel.")

if __name__ == "__main__":
    listener = EchoCodeListener()
    listener.listen()
