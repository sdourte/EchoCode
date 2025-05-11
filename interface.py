import tkinter as tk
from tkinter import ttk
import json
import os

CONFIG_FILE = "settings.json"

default_config = {
    "sound_copy": True,
    "sound_paste": True,
    "sound_undo": True,
    "sound_redo": True,
    "sound_save": True
}

class EchoCodeConfigGUI:
    def __init__(self):
        self.config = self.load_config()
        self.variables = {}

    def load_config(self):
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f)
        return default_config.copy()

    def save_config(self):
        with open(CONFIG_FILE, 'w') as f:
            json.dump(self.config, f, indent=2)

    def on_toggle(self, key):
        """Appelé à chaque changement d’état d’une checkbox"""
        self.config[key] = self.variables[key].get()
        self.save_config()
        print(f"💾 Sauvegarde auto : {key} = {self.config[key]}")

    def create_gui(self):
        self.root = tk.Tk()
        self.root.title("Panneau de configuration EchoCode")

        tk.Label(self.root, text="Choisissez les sons à activer :", font=("Arial", 14)).pack(pady=10)

        for key, value in self.config.items():
            var = tk.BooleanVar(value=value)
            chk = ttk.Checkbutton(
                self.root,
                text=key.replace("_", " ").capitalize(),
                variable=var,
                command=lambda k=key: self.on_toggle(k)
            )
            chk.pack(anchor="w", padx=20, pady=5)
            self.variables[key] = var

        self.root.mainloop()

if __name__ == "__main__":
    gui = EchoCodeConfigGUI()
    gui.create_gui()
