import os
import time
from datetime import datetime
from commit_changes import commit_database, commit_new_images

# --- Configuration ---
DB_FILE_PATH = "crosswords.db"
INACTIVITY_SECONDS = 30  # in seconds

def get_last_modification_time():
    """Retourne le timestamp de la dernière modification du fichier, ou 0 si inexistant."""
    try:
        return os.path.getmtime(DB_FILE_PATH)
    except FileNotFoundError:
        return 0

def main():
    """
    Script de surveillance qui se déclenche après une période d'inactivité.
    """
    print("Démarrage du service de surveillance intelligent...")
    last_known_mod_time = get_last_modification_time()
    committed = True # On suppose que l'état initial est "commit"

    while True:
        current_mod_time = get_last_modification_time()

        if current_mod_time > last_known_mod_time:
            # Le fichier a été modifié, on réinitialise le timer et l'état
            print(f"[{datetime.now()}] Changement détecté sur '{DB_FILE_PATH}'. Réinitialisation du timer.")
            last_known_mod_time = current_mod_time
            committed = False

        # Si le fichier n'a pas été commit et que le temps d'inactivité est écoulé
        if not committed and (time.time() - last_known_mod_time) > INACTIVITY_SECONDS:
            print(f"[{datetime.now()}] Période d'inactivité de {INACTIVITY_SECONDS}s atteinte.")
            
            # On tente de commiter la base de données et les nouvelles images
            db_success = commit_database()
            images_success = commit_new_images()

            if db_success and images_success:
                # Le commit a réussi, on met à jour l'état
                committed = True
                # On met à jour l'heure de modif connue pour ne pas recommiter immédiatement
                last_known_mod_time = get_last_modification_time()
            else:
                # Le commit a échoué, on réessaiera plus tard
                print("Un ou plusieurs commits ont échoué. Une nouvelle tentative aura lieu après la prochaine période d'inactivité.")
                # On met quand même à jour l'heure pour éviter une boucle de tentatives rapides
                last_known_mod_time = time.time()

        time.sleep(10) # Pause de 10 secondes entre chaque vérification pour ne pas surcharger le CPU

if __name__ == "__main__":
    if not os.environ.get("GITHUB_TOKEN"):
        print("ERREUR: La variable d'environnement GITHUB_TOKEN doit être définie.")
    else:
        main()
