import os
import time
import base64
import requests

# --- Configuration ---
DB_FILE_PATH = "crosswords.db"
UPLOADS_DIR = "uploads"
REPO_OWNER = "Thomzoy"
REPO_NAME = "crossword"
BRANCH = "main"

# Token d'accès personnel GitHub (à définir comme variable d'environnement)
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")

def get_github_headers():
    """Retourne les en-têtes pour les requêtes API GitHub."""
    return {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }

def get_remote_file_sha(file_path):
    """Récupère le SHA du fichier sur GitHub."""
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents/{file_path}?ref={BRANCH}"
    response = requests.get(url, headers=get_github_headers())
    if response.status_code == 200:
        return response.json()["sha"]
    return None

def get_remote_directory_contents(dir_path):
    """Récupère la liste des noms de fichiers dans un dossier sur GitHub."""
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents/{dir_path}?ref={BRANCH}"
    response = requests.get(url, headers=get_github_headers())
    if response.status_code == 200:
        return [item['name'] for item in response.json()]
    elif response.status_code == 404:
        return [] # Le dossier n'existe pas encore
    else:
        print(f"Erreur lors de la récupération du contenu du dossier '{dir_path}': {response.status_code}")
        print(response.json())
        return None # Erreur API

def upload_file_to_github(local_path, remote_path, commit_message):
    """Met à jour ou crée un fichier sur GitHub."""
    if not GITHUB_TOKEN:
        print("Erreur: La variable d'environnement GITHUB_TOKEN n'est pas définie.")
        return False

    print(f"Tentative d'upload du fichier '{local_path}' vers '{remote_path}'...")
    try:
        with open(local_path, "rb") as f:
            content_bytes = f.read()
        
        content_base64 = base64.b64encode(content_bytes).decode("utf-8")
        
        file_sha = get_remote_file_sha(remote_path) # Check if file exists

        data = {
            "message": commit_message,
            "content": content_base64,
            "branch": BRANCH,
        }
        if file_sha:
            data["sha"] = file_sha # Add sha for updates

        url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents/{remote_path}"
        response = requests.put(url, headers=get_github_headers(), json=data)

        if response.status_code == 200 or response.status_code == 201: # 200 for update, 201 for create
            print(f"Fichier '{remote_path}' mis à jour/créé avec succès sur GitHub.")
            return True
        else:
            print(f"Erreur lors de l'upload du fichier '{remote_path}': {response.status_code}")
            print(response.json())
            return False

    except FileNotFoundError:
        print(f"Le fichier local '{local_path}' n'a pas été trouvé.")
        return False
    except Exception as e:
        print(f"Une erreur est survenue lors de l'upload de '{local_path}': {e}")
        return False

def commit_database():
    """Commit le fichier de base de données."""
    return upload_file_to_github(
        local_path=DB_FILE_PATH,
        remote_path=DB_FILE_PATH,
        commit_message="Auto-commit: Update database"
    )

def commit_new_images():
    """Commit les nouvelles images du dossier uploads."""
    print("Vérification des nouvelles images à uploader...")
    try:
        # Filtrer pour ne garder que les fichiers (ignorer les sous-dossiers potentiels)
        local_files = [f for f in os.listdir(UPLOADS_DIR) if os.path.isfile(os.path.join(UPLOADS_DIR, f))]
    except FileNotFoundError:
        print(f"Le dossier local '{UPLOADS_DIR}' n'existe pas.")
        return True # Pas d'erreur, juste rien à faire

    remote_files = get_remote_directory_contents(UPLOADS_DIR)
    if remote_files is None:
        print("Impossible de continuer sans la liste des fichiers distants.")
        return False # Erreur API

    new_files = [f for f in local_files if f not in remote_files and f != '.gitkeep']
    
    if not new_files:
        print("Aucune nouvelle image à uploader.")
        return True

    print(f"Nouvelles images détectées: {new_files}")
    all_successful = True
    for filename in new_files:
        local_path = os.path.join(UPLOADS_DIR, filename)
        remote_path = f"{UPLOADS_DIR}/{filename}"
        commit_message = f"Auto-commit: Add new image {filename}"
        if not upload_file_to_github(local_path, remote_path, commit_message):
            all_successful = False
    
    if all_successful:
        print("Toutes les nouvelles images ont été uploadées avec succès.")
    else:
        print("Certaines images n'ont pas pu être uploadées.")

    return all_successful

if __name__ == "__main__":
    # Permet de tester les fonctions manuellement
    print("Test des fonctions de commit...")
    if not GITHUB_TOKEN:
        print("ERREUR: La variable d'environnement GITHUB_TOKEN doit être définie.")
    else:
        commit_database()
        commit_new_images()
