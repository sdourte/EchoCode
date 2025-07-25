# 🎧 EchoCode — Extension VS Code

**EchoCode** est une extension pour Visual Studio Code qui ajoute des **effets sonores personnalisables** aux raccourcis clavier et actions courantes de l’éditeur.

Elle permet de rendre l'expérience de code plus interactive, ludique et engageante, en jouant un son à chaque action telle que `Ctrl+C`, `Ctrl+V`, `Ctrl+S`, etc.
Chaque son est **entièrement configurable** via une interface dédiée.

En complément, EchoCode fournit une **To-Do List intégrée** avec deux modes :

* **Mode édition** : pour ajouter et organiser ses tâches librement
* **Mode review** : pour suivre un déroulé prédéfini, utile pour les revues de code, tests ou relectures

Une solution idéale pour mêler **productivité** et **plaisir** au quotidien.

---

# ✅ Check-list technique pour EchoCode

## 📥 Guide d'installation — EchoCode

### ✅ Pré-requis

1. **Installer Visual Studio Code**  
   - Télécharger ici : [https://code.visualstudio.com/](https://code.visualstudio.com/)

2. **Avoir une version récente de VS Code**  
   - Minimum recommandé : `v1.100.0` ou plus  
   - Vérifier dans VS Code via `Aide > À propos` ou `Help > About`

3. **Activer le support des extensions locales**  
   - Aucune action particulière n’est requise, tant que vous suivez l’installation décrite ci-dessous.

---

## 📦 Installation de l’extension EchoCode

### Option : Depuis le VSIX (offline)

1. Installer le fichier de l’extension qu’on vous aura transféré (`.vsix`)
2. Aller dans VS Code
3. Ouvrir la palette de commande `Ctrl+Shift+P` → `"Extensions: Install from VSIX..."`
4. Sélectionner le fichier `echocode-x.x.x.vsix`
5. Redémarrer VS Code
6. L’extension est maintenant installée !

---

## 🧪 En cas de problème

Contactez le propriétaire de l’extension EchoCode

---

## 📎 Modules nécessaires (inclus dans l'extension)

> Tout est déjà installé dans l'extension et donc dans le fichier .vsix.

| Dépendance           | Inclus ?  |
|----------------------|-----------|
| `vscode` API         | ✅ Oui    |
| `typescript`, `tsc`  | ✅ Oui (dev seulement) |
| `fs`, `path`, etc.   | ✅ NodeJS |

> Aucune installation supplémentaire n'est requise côté utilisateur si le fichier `.vsix` est fourni.