import os
import cv2
import face_recognition
import psycopg2
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import numpy as np
import io
from PIL import Image
import json

from datetime import date, time

# === Paramètres de l'application Flask ===
app = Flask(__name__)
CORS(app)

# === Paramètres PostgreSQL ===
DB_NAME = "pointage"
DB_USER = "postgres"
DB_PASSWORD = "3001"
DB_HOST = "localhost"
DB_PORT = "5432"
conn = None
cur = None

try:
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    cur = conn.cursor()
    print("[✔] Connexion à la base de données réussie.")
except psycopg2.OperationalError as e:
    print(f"[❌] Erreur de connexion à la base de données : {e}")
    conn = None
    cur = None

# === Variables globales pour les visages connus (face_recognition) ===
base_dir = 'data'
known_encodings = []
known_names = []
known_roles = []

# === Variables globales pour le modèle CNN ===
CNN_MODEL_PATH = "entrainement.h5"
CNN_LABELS_PATH = "labels.json"
cnn_model = None
cnn_labels = {}
cnn_confidence_threshold = 0.7  # Seuil de confiance pour le CNN

# === Fonctions de chargement ===
def load_face_recognition_data():
    """Charge les images pour face_recognition"""
    print("[🔄] Chargement des visages pour face_recognition...")
    
    known_encodings.clear()
    known_names.clear()
    known_roles.clear()

    if not os.path.isdir(base_dir):
        print(f"[❌] Le dossier '{base_dir}' n'existe pas.")
        return

    for role in ['Etudiants', 'Enseignants']:
        role_path = os.path.join(base_dir, role)
        if not os.path.isdir(role_path):
            print(f"[⚠️] Le dossier '{role_path}' est introuvable.")
            continue

        for person_name in os.listdir(role_path):
            person_path = os.path.join(role_path, person_name)
            
            if not os.path.isdir(person_path):
                continue

            for img_name in os.listdir(person_path):
                img_path = os.path.join(person_path, img_name)
                
                try:
                    img = face_recognition.load_image_file(img_path)
                    encodings = face_recognition.face_encodings(img)
                    
                    if encodings:
                        enc = encodings[0]
                        known_encodings.append(enc)
                        known_names.append(person_name)
                        known_roles.append(role[:-1])  # Enlève le 's' final
                        print(f"[✔] Visage chargé pour {person_name} depuis {img_path}")
                    else:
                        print(f"[⚠️] Aucun visage détecté dans {img_path}")
                
                except Exception as e:
                    print(f"[❌] Erreur lors du traitement de l'image {img_path} : {e}")
    
    print(f"[✅] {len(known_encodings)} visages chargés pour face_recognition.")

def load_cnn_model():
    """Charge le modèle CNN pré-entraîné"""
    global cnn_model, cnn_labels
    try:
        # Vérifier si le fichier modèle existe
        if not os.path.exists(CNN_MODEL_PATH):
            print(f"[⚠️] Fichier modèle CNN '{CNN_MODEL_PATH}' introuvable")
            return
            
        # Chargement conditionnel de TensorFlow
        try:
            from tensorflow.keras.models import load_model
            cnn_model = load_model(CNN_MODEL_PATH)
            
            if os.path.exists(CNN_LABELS_PATH):
                with open(CNN_LABELS_PATH, 'r') as f:
                    cnn_labels = json.load(f)
                print(f"[✔] Modèle CNN chargé avec {len(cnn_labels)} classes")
            else:
                print(f"[⚠️] Fichier labels '{CNN_LABELS_PATH}' introuvable")
                
        except ImportError:
            print("[⚠️] TensorFlow non disponible, CNN désactivé")
        except Exception as e:
            print(f"[❌] Erreur lors du chargement du modèle CNN: {e}")
            
    except Exception as e:
        print(f"[❌] Erreur lors du chargement du modèle CNN: {e}")

# Charger les données au démarrage
load_face_recognition_data()
load_cnn_model()

# === Fonctions de reconnaissance améliorées ===
def recognize_with_face_recognition(image):
    """Reconnaissance avec face_recognition (méthode principale)"""
    try:
        # Convertir l'image PIL en numpy array
        img_array = np.array(image)
        
        # Convertir en RGB si nécessaire
        if len(img_array.shape) == 2:  # Image en niveaux de gris
            img_array = cv2.cvtColor(img_array, cv2.COLOR_GRAY2RGB)
        elif img_array.shape[2] == 4:  # Image RGBA
            img_array = cv2.cvtColor(img_array, cv2.COLOR_RGBA2RGB)
        
        # Détection des visages et encodages
        face_locations = face_recognition.face_locations(img_array)
        face_encodings = face_recognition.face_encodings(img_array, face_locations)
        
        if not face_encodings:
            return None, None, 0
        
        # Comparer avec les visages connus
        matches = face_recognition.compare_faces(known_encodings, face_encodings[0], tolerance=0.6)
        
        if True in matches:
            # Trouver la meilleure correspondance
            face_distances = face_recognition.face_distance(known_encodings, face_encodings[0])
            best_match_index = np.argmin(face_distances)
            
            if matches[best_match_index]:
                name = known_names[best_match_index]
                role = known_roles[best_match_index]
                confidence = 1 - face_distances[best_match_index]  # Convertir distance en confiance
                
                return name, role, confidence
        
        return None, None, 0
        
    except Exception as e:
        print(f"Erreur dans recognize_with_face_recognition: {e}")
        return None, None, 0

def predict_with_cnn(image):
    """Reconnaissance avec le modèle CNN (méthode secondaire)"""
    if cnn_model is None:
        return None, None, 0
    
    try:
        # Prétraiter l'image pour le modèle CNN
        img = image.resize((100, 100))
        
        # Convertir en array et normaliser
        img_array = np.array(img) / 255.0
        
        # Ajouter dimension batch si nécessaire
        if len(img_array.shape) == 3:
            img_array = np.expand_dims(img_array, axis=0)
        
        # Prédiction
        predictions = cnn_model.predict(img_array, verbose=0)
        confidence = np.max(predictions)
        class_index = np.argmax(predictions)
        
        # Trouver le nom correspondant à l'index
        for name, idx in cnn_labels.items():
            if idx == class_index:
                role = "Etudiant" if "etudiant" in name.lower() else "Enseignant"
                return name, role, confidence
        
        return None, None, confidence
        
    except Exception as e:
        print(f"Erreur lors de la prédiction CNN: {e}")
        return None, None, 0

def hybrid_recognition(image):
    """
    Reconnaissance hybride: utilise d'abord face_recognition, 
    puis CNN si nécessaire avec fusion des résultats
    """
    # Méthode 1: face_recognition (plus robuste)
    name_fr, role_fr, confidence_fr = recognize_with_face_recognition(image)
    
    if confidence_fr > 0.6:  # Bonne confiance avec face_recognition
        return name_fr, role_fr, confidence_fr, "face_recognition"
    
    # Méthode 2: CNN (en complément)
    name_cnn, role_cnn, confidence_cnn = predict_with_cnn(image)
    
    if confidence_cnn > cnn_confidence_threshold:
        return name_cnn, role_cnn, confidence_cnn, "cnn"
    
    # Si les deux méthodes échouent
    if confidence_fr > 0:  # Préférer face_recognition même avec faible confiance
        return name_fr, role_fr, confidence_fr, "face_recognition_fallback"
    
    return None, None, 0, "none"

# === Routes API ===
@app.route('/reconnaissance_hybride', methods=['POST'])
def reconnaissance_hybride():
    """Endpoint de reconnaissance hybride améliorée"""
    if not request.json or 'image' not in request.json:
        return jsonify({"status": "error", "message": "Aucune image fournie"}), 400
    
    try:
        # Décodage de l'image
        image_data = request.json['image']
        if image_data.startswith('data:image'):
            image_data = base64.b64decode(image_data.split(',')[1])
        else:
            image_data = base64.b64decode(image_data)
        
        # Conversion en image PIL
        img = Image.open(io.BytesIO(image_data))
        
        # Reconnaissance hybride
        name, role, confidence, method = hybrid_recognition(img)
        
        if name and confidence > 0.5:  # Seuil global de confiance
            return jsonify({
                "status": "success",
                "name": name,
                "role": role,
                "confidence": float(confidence),
                "method": method,
                "message": f"Reconnu par {method} avec {confidence*100:.1f}% de confiance"
            })
        else:
            return jsonify({
                "status": "warning",
                "message": "Personne non reconnue. Veuillez vous rapprocher de la caméra ou améliorer l'éclairage.",
                "confidence": float(confidence) if confidence else 0
            })
            
    except Exception as e:
        print(f"Erreur lors de la reconnaissance hybride: {str(e)}")
        return jsonify({
            "status": "error", 
            "message": f"Erreur de traitement: {str(e)}"
        }), 500

@app.route('/enregistrer_presence', methods=['POST'])
def enregistrer_presence_manuelle():
    """Endpoint pour enregistrer manuellement une présence"""
    data = request.json
    if not data or 'nom' not in data or 'role' not in data or 'type' not in data:
        return jsonify({"status": "error", "message": "Données manquantes"}), 400
    
    nom = data['nom']
    role = data['role']
    presence_type = data['type']
    cours = data.get('cours', None)
    
    success, message = enregistrer_presence_db(nom, role, presence_type, cours)
    
    if success:
        return jsonify({"status": "success", "message": message})
    else:
        return jsonify({"status": "error", "message": message}), 500

# def enregistrer_presence_db(nom, role, statut, cours=None):
#     """Enregistre la présence dans la base de données"""
#     try:
#         conn = psycopg2.connect(
#             dbname=DB_NAME, 
#             user=DB_USER, 
#             password=DB_PASSWORD, 
#             host=DB_HOST, 
#             port=DB_PORT
#         )
#         cur = conn.cursor()
        
#         # Vérifier si présence déjà enregistrée aujourd'hui
#         cur.execute("""
#             SELECT id FROM presences 
#             WHERE nom = %s AND role = %s AND date_presence = CURRENT_DATE AND statut = %s
#         """, (nom, role, statut))
        
#         if cur.fetchone():
#             return False, "Présence déjà enregistrée"
        
#         # Enregistrer la nouvelle présence - CORRECTION ICI
#         if cours:
#             # Utilisez le nom correct de votre colonne (probablement "matiere")
#             cur.execute("""
#                 INSERT INTO presences (nom, role, date_presence, heure_presence, statut, matiere)
#                 VALUES (%s, %s, CURRENT_DATE, CURRENT_TIME, %s, %s)
#             """, (nom, role, statut, cours))
#         else:
#             cur.execute("""
#                 INSERT INTO presences (nom, role, date_presence, heure_presence, statut)
#                 VALUES (%s, %s, CURRENT_DATE, CURRENT_TIME, %s)
#             """, (nom, role, statut))
        
#         conn.commit()
#         return True, "Présence enregistrée avec succès"
        
#     except Exception as e:
#         if conn:
#             conn.rollback()
#         print(f"[❌] Erreur lors de l'enregistrement: {e}")
#         return False, f"Erreur: {e}"
#     finally:
#         if cur:
#             cur.close()
#         if conn:
#             conn.close()

def enregistrer_presence_db(nom, role, statut, cours=None):
    """Enregistre la présence dans la base de données"""
    conn = None
    cur = None
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME, 
            user=DB_USER, 
            password=DB_PASSWORD, 
            host=DB_HOST, 
            port=DB_PORT
        )
        cur = conn.cursor()
        
        # Vérifier si présence déjà enregistrée aujourd'hui
        cur.execute("""
            SELECT id FROM presences 
            WHERE nom = %s AND role = %s AND date_presence = CURRENT_DATE AND statut = %s
        """, (nom, role, statut))
        
        if cur.fetchone():
            return False, "Présence déjà enregistrée"
        
        # Enregistrer la nouvelle présence
        if cours:
            cur.execute("""
                INSERT INTO presences (nom, role, date_presence, heure_presence, statut, matiere)
                VALUES (%s, %s, CURRENT_DATE, CURRENT_TIME, %s, %s)
            """, (nom, role, statut, cours))
        else:
            cur.execute("""
                INSERT INTO presences (nom, role, date_presence, heure_presence, statut)
                VALUES (%s, %s, CURRENT_DATE, CURRENT_TIME, %s)
            """, (nom, role, statut))
        
        conn.commit()
        return True, "Présence enregistrée avec succès"
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[❌] Erreur lors de l'enregistrement: {e}")
        return False, f"Erreur: {e}"
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()



@app.route('/reload_faces', methods=['POST'])
def reload_faces():
    """Recharge les visages depuis le dossier data"""
    load_face_recognition_data()
    return jsonify({
        "status": "success", 
        "message": f"{len(known_encodings)} visages rechargés",
        "count": len(known_encodings)
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint de santé du serveur"""
    return jsonify({
        "status": "success",
        "message": "Serveur opérationnel",
        "timestamp": datetime.now().isoformat(),
        "faces_loaded": len(known_encodings),
        "cnn_loaded": cnn_model is not None
    })

@app.route('/test_connection', methods=['GET'])
def test_connection():
    """Teste la connexion à la base de données"""
    try:
        test_conn = psycopg2.connect(
            dbname=DB_NAME, 
            user=DB_USER, 
            password=DB_PASSWORD, 
            host=DB_HOST, 
            port=DB_PORT
        )
        test_conn.close()
        return jsonify({"status": "success", "message": "Connexion BD OK"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/dashboard_data', methods=['GET'])
def get_dashboard_data():
    """
    Récupère les données de présence et les formate pour le tableau de bord.
    """
    if conn is None or cur is None:
        return jsonify({"status": "error", "message": "Connexion à la base de données inactive."}), 500

    try:
        # 1. Récupérer les présences du jour
        today = datetime.now().strftime("%Y-%m-%d")
        cur.execute("""
            SELECT nom, role, heure_presence
            FROM presences
            WHERE date_presence = %s
            ORDER BY heure_presence ASC;
        """, (today,))
        
        presences = cur.fetchall()
        
        # 2. Récupérer tous les étudiants et enseignants
        cur.execute("SELECT nom FROM etudiants;")
        all_etudiants = [row[0] for row in cur.fetchall()]
        
        cur.execute("SELECT nom FROM enseignants;")
        all_enseignants = [row[0] for row in cur.fetchall()]
        
        all_users = [(nom, "Etudiant") for nom in all_etudiants] + [(nom, "Enseignant") for nom in all_enseignants]
        
        if not presences:
            # Si aucune présence aujourd'hui, tous les utilisateurs sont absents
            absents = [{"nom": user[0], "role": user[1]} for user in all_users]
            return jsonify({
                "status": "success", 
                "data": {
                    "presents": [], 
                    "absents": absents, 
                    "retards": []
                }
            })

        # 3. Formater les données pour le tableau de bord
        data = {
            "presents": [],
            "retards": [],
            "absents": []
        }
        
        # Exemple de logique pour détecter un retard (heure d'arrivée après 08h00)
        heure_retard_limite = datetime.strptime("09:30:00", "%H:%M:%S").time()
        noms_presents = set()

        for nom, role, heure in presences:
            heure_str = heure.strftime("%H:%M:%S") if hasattr(heure, 'strftime') else str(heure)
            presence_info = {"nom": nom, "role": role, "heure_presence": heure_str}
            noms_presents.add((nom, role))
            
            # Convertir l'heure en time object si c'est une string
            if isinstance(heure, str):
                heure_time = datetime.strptime(heure, "%H:%M:%S").time()
            else:
                heure_time = heure.time() if hasattr(heure, 'time') else heure
            
            if heure_time > heure_retard_limite:
                data["retards"].append(presence_info)
            else:
                data["presents"].append(presence_info)

        # 4. Identifier les absents (tous les utilisateurs non présents aujourd'hui)
        for nom, role in all_users:
            if (nom, role) not in noms_presents:
                data["absents"].append({"nom": nom, "role": role})

        return jsonify({"status": "success", "data": data})

    except Exception as e:
        print(f"Erreur lors de la récupération des données du tableau de bord : {e}")
        return jsonify({"status": "error", "message": f"Erreur de traitement: {e}"}), 500

# === Point de terminaison pour les détails d'une personne ===
@app.route('/person_details/<role>/<nom>', methods=['GET'])
def get_person_details(role, nom):
    """
    Récupère tous les détails d'une personne selon son rôle.
    """
    if conn is None or cur is None:
        return jsonify({"status": "error", "message": "Connexion à la base de données inactive."}), 500

    try:
        # Déterminer la table en fonction du rôle
        table_name = "etudiants" if role.lower() == "etudiant" else "enseignants"
        
        # Récupérer tous les détails de la personne
        cur.execute(f"SELECT * FROM {table_name} WHERE nom = %s", (nom,))
        person_details = cur.fetchone()
        
        if person_details:
            # Récupérer les noms des colonnes
            cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = %s", (table_name,))
            columns = [row[0] for row in cur.fetchall()]
            
            # Créer un dictionnaire avec les détails
            details_dict = dict(zip(columns, person_details))
            return jsonify({"status": "success", "data": details_dict})
        else:
            return jsonify({"status": "error", "message": "Personne non trouvée."}), 404
            
    except Exception as e:
        print(f"Erreur lors de la récupération des détails: {e}")
        return jsonify({"status": "error", "message": f"Erreur de traitement: {e}"}), 500


# === Routes pour la gestion des étudiants et enseignants ===

@app.route('/etudiants', methods=['GET'])
def get_etudiants():
    """Récupère tous les étudiants"""
    try:
        cur.execute("SELECT * FROM etudiants ORDER BY nom")
        etudiants = cur.fetchall()
        
        # Récupérer les noms des colonnes
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'etudiants'")
        columns = [row[0] for row in cur.fetchall()]
        
        # Convertir en dictionnaires
        etudiants_list = []
        for etudiant in etudiants:
            etudiants_list.append(dict(zip(columns, etudiant)))
            
        return jsonify({"status": "success", "data": etudiants_list})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/enseignants', methods=['GET'])
def get_enseignants():
    """Récupère tous les enseignants"""
    try:
        cur.execute("SELECT * FROM enseignants ORDER BY nom")
        enseignants = cur.fetchall()
        
        # Récupérer les noms des colonnes
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'enseignants'")
        columns = [row[0] for row in cur.fetchall()]
        
        # Convertir en dictionnaires
        enseignants_list = []
        for enseignant in enseignants:
            enseignants_list.append(dict(zip(columns, enseignant)))
            
        return jsonify({"status": "success", "data": enseignants_list})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/presences', methods=['GET'])
def get_presences():
    """Récupère tous les étudiants"""
    try:
        cur.execute("SELECT * FROM presences ORDER BY date_presence")
        presences = cur.fetchall()
        
        # Récupérer les noms des colonnes
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'presences'")
        columns = [row[0] for row in cur.fetchall()]
        
        # Convertir en dictionnaires et formater les dates/heures
        presence_list = []
        for presence in presences:
            item_dict = dict(zip(columns, presence))
            
            # === AJOUT DE LA LOGIQUE DE FORMATAGE ===
            for key, value in item_dict.items():
                # Vérifie si la valeur est un objet de date ou d'heure et la convertit en chaîne
                if isinstance(value, date):
                    item_dict[key] = value.isoformat()  # ex: '2023-10-27'
                elif isinstance(value, time):
                    item_dict[key] = value.isoformat()  # ex: '08:30:00'
            
            presence_list.append(item_dict)
            
        return jsonify({"status": "success", "data": presence_list })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


@app.route('/<table>/<int:id>', methods=['DELETE'])
def delete_item(table, id):
    if table not in ['etudiants', 'enseignants', 'presences']:
        return jsonify({"status": "error", "message": "Table invalide"})
    
    try:
        cur.execute(f"DELETE FROM {table} WHERE id = %s", (id,))
        conn.commit()
        return jsonify({"status": "success", "message": "Supprimé avec succès"})
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)})

@app.route('/<table>', methods=['POST'])
def add_item(table):
    if table not in ['etudiants', 'enseignants', 'presences']:
        return jsonify({"status": "error", "message": "Table invalide"})
    
    try:
        data = request.json
        columns = ', '.join(data.keys())
        values = ', '.join(['%s'] * len(data))
        
        cur.execute(f"INSERT INTO {table} ({columns}) VALUES ({values})", list(data.values()))
        conn.commit()
        return jsonify({"status": "success", "message": "Ajouté avec succès"})
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)})


@app.route('/<table>', methods=['GET'])
def get_items(table):
    if table not in ['etudiants', 'enseignants', 'presences']:
        return jsonify({"status": "error", "message": "Table invalide"}), 400
    
    try:
        cur.execute(f"SELECT * FROM {table}")
        items = cur.fetchall()
        
        # Récupérer les noms des colonnes
        cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table}'")
        columns = [row[0] for row in cur.fetchall()]
        
        # Convertir en liste de dictionnaires
        items_list = []
        for item in items:
            item_dict = dict(zip(columns, item))
            
            # Convertir les dates/heures en chaîne de caractères
            for key, value in item_dict.items():
                if isinstance(value, (date, time)):
                    item_dict[key] = value.isoformat()
            
            items_list.append(item_dict)
            
        return jsonify({"status": "success", "data": items_list})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


if __name__ == "__main__":
    print("=== Serveur de reconnaissance faciale démarré ===")
    print(f"Visages chargés: {len(known_encodings)}")
    print(f"Modèle CNN: {'Chargé' if cnn_model else 'Non disponible'}")
    print("Endpoint santé: http://localhost:5000/health")
    print("Endpoint test BD: http://localhost:5000/test_connection")
    
    app.run(host='0.0.0.0', port=5000, debug=True)