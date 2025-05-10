import keyboard
import pygame
import os

# Initialisation du mixer pygame
pygame.mixer.init()

# Dossier des sons
sound_folder = 'sounds'

# Dictionnaire des raccourcis clavier et leurs sons associés
sound_map = {
    'ctrl+c': os.path.join(sound_folder, 'copy.mp3'),
    'ctrl+v': os.path.join(sound_folder, 'paste.mp3'),
    'ctrl+z': os.path.join(sound_folder, 'undo.mp3'),
    'ctrl+y': os.path.join(sound_folder, 'redo.mp3')
}

# Dictionnaire pour suivre l'état des raccourcis
shortcut_state = {shortcut: False for shortcut in sound_map.keys()}

def play_sound(file):
    """Fonction pour jouer un son."""
    if os.path.exists(file):  # Vérifier si le fichier existe
        sound = pygame.mixer.Sound(file)
        sound.play()
    else:
        print(f"⚠️ Le fichier audio {file} est introuvable.")

# Fonction principale pour écouter les raccourcis
def listen_for_shortcuts():
    print("🎧 En écoute des raccourcis clavier...")

    # Écouter en permanence les raccourcis
    while True:
        for shortcut in sound_map.keys():
            if keyboard.is_pressed(shortcut):
                # Si le raccourci n'a pas été déjà joué
                if not shortcut_state[shortcut]:
                    print(f"✅ Raccourci détecté : {shortcut.upper()}")
                    play_sound(sound_map[shortcut])
                    shortcut_state[shortcut] = True  # Marquer le raccourci comme joué
            else:
                # Quand la touche est relâchée, réinitialiser l'état
                shortcut_state[shortcut] = False

if __name__ == "__main__":
    listen_for_shortcuts()
