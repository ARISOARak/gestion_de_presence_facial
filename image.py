import os
import base64
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

# Définir les chemins de base
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
ETUDIANTS_DIR = os.path.join(DATA_DIR, "Etudiants")
ENSEIGNANTS_DIR = os.path.join(DATA_DIR, "Enseignants")

# Créer les dossiers au démarrage si besoin
os.makedirs(ETUDIANTS_DIR, exist_ok=True)
os.makedirs(ENSEIGNANTS_DIR, exist_ok=True)

class SimpleHTTPRequestHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path == "/sauvegarder-image":
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length)

            try:
                data = json.loads(post_data.decode("utf-8"))
                nom = data.get("nom", "").strip().replace(" ", "_")
                prenom = data.get("prenom", "").strip().replace(" ", "_")
                role = data.get("role", "").lower()
                image_base64 = data.get("image", "")
                index = data.get("index", None)  # facultatif

                # Validation des champs
                if not all([nom, prenom, role, image_base64]):
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"Champs manquants.")
                    return

                nom_complet = f"{nom}_{prenom}"
                dossier_cible = ETUDIANTS_DIR if role == "etudiant" else ENSEIGNANTS_DIR
                chemin_dossier = os.path.join(dossier_cible, nom_complet)
                os.makedirs(chemin_dossier, exist_ok=True)

                # Nettoyer l'image base64
                if "base64," in image_base64:
                    image_base64 = image_base64.split(",")[1]

                # Déterminer un nom de fichier unique
                if index is None:
                    fichiers_existants = [
                        f for f in os.listdir(chemin_dossier) if f.startswith("photo_") and f.endswith(".png")
                    ]
                    numero = len(fichiers_existants) + 1
                    fichier_nom = f"photo_{numero:03d}.png"
                else:
                    fichier_nom = f"photo_{int(index):03d}.png"

                chemin_fichier = os.path.join(chemin_dossier, fichier_nom)

                # Sauvegarde de l'image
                with open(chemin_fichier, "wb") as f:
                    f.write(base64.b64decode(image_base64))

                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(b"Image sauvegardee avec succes.")

            except Exception as e:
                self.send_response(500)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(f"Erreur serveur : {str(e)}".encode())

        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Route non trouvee.")

# Lancement du serveur
def run():
    server_address = ("localhost", 8081)
    httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)
    print("✅ Serveur actif sur http://localhost:8081")
    httpd.serve_forever()

if __name__ == "__main__":
    run()
