import os
import time
import base64
import requests

# --- Configuration ---
DB_FILE_PATH = "crosswords.db"
REPO_OWNER = "Thomzoy"
REPO_NAME = "crossword"
BRANCH = "main"
COMMIT_MESSAGE = "Auto-commit: Update database"

# Token d'accès personnel GitHub (à définir comme variable d'environnement)
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")

def get_github_headers():
    """Retourne les en-têtes pour les requêtes API GitHub."""
    return {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }

def get_file_sha(file_path):
    """Récupère le SHA du fichier sur GitHub."""
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents/{file_path}?ref={BRANCH}"
    response = requests.get(url, headers=get_github_headers())
    if response.status_code == 200:
        return response.json()["sha"]
    return None

def update_file_on_github():
    """Met à jour le fichier de base de données sur GitHub via l'API."""
    if not GITHUB_TOKEN:
        print("Erreur: La variable d'environnement GITHUB_TOKEN n'est pas définie.")
        return False

    print("Tentative de mise à jour du fichier sur GitHub...")
    try:
        with open(DB_FILE_PATH, "rb") as f:
            content_bytes = f.read()
        
        content_base64 = base64.b64encode(content_bytes).decode("utf-8")
        
        file_sha = get_file_sha(DB_FILE_PATH)
        if not file_sha:
            print(f"Le fichier '{DB_FILE_PATH}' n'existe pas dans le dépôt ou erreur API.")
            return False

        data = {
            "message": COMMIT_MESSAGE,
            "content": content_base64,
            "sha": file_sha,
            "branch": BRANCH,
        }

        url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents/{DB_FILE_PATH}"
        response = requests.put(url, headers=get_github_headers(), json=data)

        if response.status_code == 200:
            print("Fichier mis à jour avec succès sur GitHub.")
            return True
        else:
            print(f"Erreur lors de la mise à jour du fichier: {response.status_code}")
            print(response.json())
            return False

    except FileNotFoundError:
        print(f"Le fichier local '{DB_FILE_PATH}' n'a pas été trouvé.")
        return False
    except Exception as e:
        print(f"Une erreur est survenue: {e}")
        return False

if __name__ == "__main__":
    # Permet de tester la fonction de mise à jour manuellement
    print("Test de la mise à jour manuelle...")
    update_file_on_github()
