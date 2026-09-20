# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import date
from flask_bcrypt import Bcrypt

app = Flask(__name__)
# IMPORTANT: CORS permet au frontend (exécuté sur un autre port) de communiquer avec le backend
CORS(app) 
bcrypt = Bcrypt(app)

# --- Configuration de la Base de Données PostgreSQL ---
# REMPLACER CES VALEURS PAR VOS PROPRES IDENTIFIANTS PGADMIN
DB_NAME = "pointage"
DB_USER = "postgres"
DB_PASS = "3001"
DB_HOST = "localhost"
DB_PORT = "5432"

def get_db_connection():
    """Établit et retourne une connexion à la base de données."""
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        host=DB_HOST,
        port=DB_PORT
    )
    return conn

# --- Fonction Utilitaires pour l'Initialisation des Tables ---
def create_tables():
    """Crée les tables si elles n'existent pas."""
    commands = (
        # 1. Table des Enseignants
        """
        CREATE TABLE IF NOT EXISTS enseignants (
            id SERIAL PRIMARY KEY,
            nom VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            matiere VARCHAR(100),
            statut VARCHAR(50) DEFAULT 'actif'
        )
        """,
        # 2. Table des Étudiants
        """
        CREATE TABLE IF NOT EXISTS etudiants (
            id SERIAL PRIMARY KEY,
            nom VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            classe VARCHAR(100),
            statut VARCHAR(50) DEFAULT 'actif'
        )
        """,
        # 3. Table des Présences
        """
        CREATE TABLE IF NOT EXISTS presences (
            id SERIAL PRIMARY KEY,
            utilisateur_id INTEGER NOT NULL,
            type_utilisateur VARCHAR(50) NOT NULL, -- 'etudiant' ou 'enseignant'
            heure_arrivee TIMESTAMP NOT NULL,
            heure_depart TIMESTAMP NULL,
            statut_arrivee VARCHAR(50) -- 'present', 'retard', 'absent'
        )
        """
    )
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        for command in commands:
            cur.execute(command)
        cur.close()
        conn.commit()
        print("Les tables ont été vérifiées/créées avec succès.")
    except (Exception, psycopg2.Error) as error:
        print(f"Erreur lors de la création des tables: {error}")
    finally:
        if conn is not None:
            conn.close()

# --- Routes API (CRUD Enseignants) ---

@app.route('/api/enseignants', methods=['GET'])
def get_enseignants():
    conn = get_db_connection()
    # Utilise RealDictCursor pour retourner les résultats sous forme de dictionnaire
    cur = conn.cursor(cursor_factory=RealDictCursor) 
    cur.execute("SELECT * FROM enseignants ORDER BY id")
    enseignants = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(enseignants)

@app.route('/api/enseignants', methods=['POST'])
def add_enseignant():
    new_enseignant = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO enseignants (nom, email, matiere, statut) VALUES (%s, %s, %s, %s) RETURNING id",
            (new_enseignant['nom'], new_enseignant['email'], new_enseignant['matiere'], new_enseignant['statut'])
        )
        enseignant_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": enseignant_id, "message": "Enseignant ajouté"}), 201
    except psycopg2.IntegrityError as e:
        conn.rollback()
        return jsonify({"error": "L'e-mail existe déjà ou les données sont invalides.", "details": str(e)}), 400
    finally:
        cur.close()
        conn.close()

@app.route('/api/enseignants/<int:id>', methods=['PUT'])
def update_enseignant(id):
    update_data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE enseignants SET nom = %s, email = %s, matiere = %s, statut = %s WHERE id = %s",
            (update_data['nom'], update_data['email'], update_data['matiere'], update_data['statut'], id)
        )
        conn.commit()
        if cur.rowcount == 0:
            return jsonify({"error": "Enseignant non trouvé"}), 404
        return jsonify({"message": f"Enseignant {id} mis à jour"}), 200
    finally:
        cur.close()
        conn.close()

@app.route('/api/enseignants/<int:id>', methods=['DELETE'])
def delete_enseignant(id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM enseignants WHERE id = %s", (id,))
        conn.commit()
        if cur.rowcount == 0:
            return jsonify({"error": "Enseignant non trouvé"}), 404
        return jsonify({"message": f"Enseignant {id} supprimé"}), 200
    finally:
        cur.close()
        conn.close()

# --- Routes API (CRUD Étudiants) ---
# NOTE: Le même modèle est utilisé pour les étudiants.

@app.route('/api/etudiants', methods=['GET'])
def get_etudiants():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM etudiants ORDER BY id")
    etudiants = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(etudiants)

@app.route('/api/etudiants', methods=['POST'])
def add_etudiant():
    new_etudiant = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO etudiants (nom, email, classe, statut) VALUES (%s, %s, %s, %s) RETURNING id",
            (new_etudiant['nom'], new_etudiant['email'], new_etudiant['classe'], new_etudiant['statut'])
        )
        etudiant_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": etudiant_id, "message": "Étudiant ajouté"}), 201
    except psycopg2.IntegrityError as e:
        conn.rollback()
        return jsonify({"error": "L'e-mail existe déjà ou les données sont invalides.", "details": str(e)}), 400
    finally:
        cur.close()
        conn.close()

@app.route('/api/etudiants/<int:id>', methods=['PUT'])
def update_etudiant(id):
    update_data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE etudiants SET nom = %s, email = %s, classe = %s, statut = %s WHERE id = %s",
            (update_data['nom'], update_data['email'], update_data['classe'], update_data['statut'], id)
        )
        conn.commit()
        if cur.rowcount == 0:
            return jsonify({"error": "Étudiant non trouvé"}), 404
        return jsonify({"message": f"Étudiant {id} mis à jour"}), 200
    finally:
        cur.close()
        conn.close()

@app.route('/api/etudiants/<int:id>', methods=['DELETE'])
def delete_etudiant(id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM etudiants WHERE id = %s", (id,))
        conn.commit()
        if cur.rowcount == 0:
            return jsonify({"error": "Étudiant non trouvé"}), 404
        return jsonify({"message": f"Étudiant {id} supprimé"}), 200
    finally:
        cur.close()
        conn.close()



# --- Routes API (Authentification Admin) ---

@app.route('/api/auth/register', methods=['POST'])
def register_admin():
    # ... (code inchangé pour la récupération des données et le hachage)
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"message": "Email et mot de passe requis."}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Tente d'insérer le nouvel administrateur
        cur.execute(
            "INSERT INTO admins (email, password_hash) VALUES (%s, %s);",
            (email, hashed_password)
        )
        conn.commit()
        return jsonify({"message": "Inscription administrateur réussie. Vous pouvez maintenant vous connecter."}), 201
        
    except psycopg2.IntegrityError as e:
        conn.rollback() 
        
        # AJOUT POUR LE DÉBOGAGE: Afficher le code d'erreur réel de la base de données
        print(f"PostgreSQL Integrity Error Code: {e.pgcode}")
        print(f"PostgreSQL Integrity Error Message: {e}")
        
        # Le code d'erreur 23505 est la violation de contrainte unique
        if e.pgcode == '23505':
            return jsonify({"message": "Cet email est déjà utilisé (Contrainte UNIQUE violée)."}), 409
        else:
            return jsonify({"message": "Erreur d'intégrité de la base de données."}), 500
        
    except Exception as e:
        conn.rollback()
        print(f"Erreur d'inscription inattendue: {e}")
        return jsonify({"message": "Erreur serveur lors de l'inscription: " + str(e)}), 500
        
    finally:
        cur.close()
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login_admin():
    """Connexion d'un administrateur existant."""
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"message": "Email et mot de passe requis."}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Récupère le hash du mot de passe
        cur.execute("SELECT password_hash FROM admins WHERE email = %s;", (email,))
        admin = cur.fetchone()
        
        if admin:
            password_hash = admin[0]
            # Vérifie le mot de passe haché
            if bcrypt.check_password_hash(password_hash, password):
                return jsonify({"message": "Connexion réussie.", "success": True}), 200
            else:
                # Échec: Mot de passe incorrect
                return jsonify({"message": "Email ou mot de passe invalide."}), 401
        else:
            # Échec: Email non trouvé
            return jsonify({"message": "Email ou mot de passe invalide."}), 401
            
    except Exception as e:
        # Affichage détaillé de l'erreur côté serveur
        print(f"Erreur de connexion (BDD/Serveur): {e}")
        return jsonify({"message": "Erreur serveur lors de la connexion."}), 500
    finally:
        cur.close()
        conn.close()



# ... (Après les routes /api/etudiants)



# app.py (dans la fonction get_stats, autour de la ligne 240)

@app.route('/api/dashboard/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    cur = conn.cursor()
    stats = {}
    try:
        # ... (Requêtes pour enseignants et étudiants restent inchangées)

        cur.execute("SELECT COUNT(*) FROM enseignants;")
        stats['enseignant_count'] = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM etudiants;")
        stats['etudiant_count'] = cur.fetchone()[0]
        
        # 1. Requête pour les Présents d'aujourd'hui (CORRIGÉ pour date_presence)
        # Utilise la colonne date_presence pour filtrer la journée en cours
        cur.execute(
             "SELECT COUNT(*) FROM presences WHERE date_presence = current_date AND statut = 'present';"
        )
        stats['presents_today'] = cur.fetchone()[0]
        
        # 2. Requête pour les Retards d'aujourd'hui (CORRIGÉ pour date_presence)
        cur.execute(
             "SELECT COUNT(*) FROM presences WHERE date_presence = current_date AND statut = 'retard';"
        )
        stats['retards_today'] = cur.fetchone()[0]
        
    except (Exception, psycopg2.Error) as error:
        print(f"Erreur lors de la récupération des stats: {error}")
        return jsonify({"error": "Erreur de base de données"}), 500
    finally:
        cur.close()
        conn.close()
        
    return jsonify(stats)

# app.py (Ajouter sous les autres routes)

@app.route('/api/stats/monthly_attendance', methods=['GET'])
def get_monthly_attendance():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Calcule le total d'entrées et le total de présences (incluant retards) par mois
    query = """
    SELECT
        TO_CHAR(date_presence, 'YYYY-MM') AS month_key,
        TO_CHAR(date_presence, 'Mon YYYY') AS month,
        CAST(COUNT(CASE WHEN statut_arrivee IN ('present', 'retard') THEN 1 END) AS FLOAT) / 
        CAST(COUNT(*) AS FLOAT) * 100 AS presence_rate
    FROM presences
    GROUP BY month_key, month
    ORDER BY month_key;
    """
    
    try:
        cur.execute(query)
        data = cur.fetchall()
        return jsonify(data)
    except Exception as e:
        print(f"Erreur lors de la récupération des stats mensuelles: {e}")
        return jsonify({"error": "Erreur de base de données"}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/api/presences/register', methods=['POST'])
def register_presence():
    """
    Enregistre la présence d'un utilisateur.
    Requiert: utilisateur_id (ID dans la table etudiants/enseignants), 
              type_utilisateur ('etudiant'/'enseignant'), 
              statut_arrivee ('present'/'retard'/'absent').
    """
    data = request.get_json()
    utilisateur_id = data.get('utilisateur_id')
    type_utilisateur = data.get('type_utilisateur')
    statut_arrivee = data.get('statut_arrivee')

    if not all([utilisateur_id, type_utilisateur, statut_arrivee]):
        return jsonify({"message": "Données incomplètes (ID, type, statut) requises."}), 400

    if type_utilisateur not in ['etudiant', 'enseignant']:
        return jsonify({"message": "Type d'utilisateur invalide."}), 400
        
    if statut_arrivee not in ['present', 'retard', 'absent']:
        return jsonify({"message": "Statut d'arrivée invalide."}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Vérification si une présence existe déjà pour cet utilisateur/type aujourd'hui
        cur.execute(
            """
            SELECT id FROM presences 
            WHERE utilisateur_id = %s AND type_utilisateur = %s AND date_presence = CURRENT_DATE;
            """,
            (utilisateur_id, type_utilisateur)
        )
        if cur.fetchone():
            return jsonify({"message": "Présence déjà enregistrée pour cet utilisateur aujourd'hui."}), 409
            
        # Enregistrement de la nouvelle présence
        cur.execute(
            """
            INSERT INTO presences (utilisateur_id, type_utilisateur, statut_arrivee)
            VALUES (%s, %s, %s);
            """,
            (utilisateur_id, type_utilisateur, statut_arrivee)
        )
        conn.commit()
        return jsonify({"message": "Présence enregistrée avec succès.", "id": utilisateur_id}), 201
        
    except Exception as e:
        conn.rollback()
        # En cas d'erreur inattendue (ex: utilisateur_id n'existe pas)
        print(f"Erreur lors de l'enregistrement de la présence: {e}")
        return jsonify({"message": "Erreur serveur lors de l'enregistrement."}), 500
        
    finally:
        cur.close()
        conn.close()



@app.route('/api/presences', methods=['GET'])
def get_presences():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    query = """
    SELECT 
        p.id,
        CASE 
            WHEN p.role = 'enseignant' THEN e.nom
            WHEN p.role = 'etudiant' THEN t.nom
            ELSE 'Utilisateur inconnu'
        END AS nom_utilisateur,
        p.role,
        p.date_presence,    -- <--- CHANGEMENT MAJEUR
        p.heure_presence,   -- <--- CHANGEMENT MAJEUR
        p.statut
    FROM presences p
    LEFT JOIN enseignants e ON p.id = e.id AND p.role = 'enseignant'
    LEFT JOIN etudiants t ON p.id = t.id AND p.role = 'etudiant'
    ORDER BY date_presence DESC, heure_presence DESC;
    """
    
    try:
        cur.execute(query)
        presences = cur.fetchall()
    except Exception as e:
        print(f"Erreur lors de l'exécution de la requête presences: {e}")
        return jsonify({"error": "Erreur SQL lors de la récupération des présences"}), 500
    finally:
        cur.close()
        conn.close()
    
    # Le formatage a été ajusté pour correspondre aux nouveaux noms de champs
    for p in presences:
        if p.get('date_presence'):
            p['date_presence'] = p['date_presence'].isoformat()
        if p.get('heure_presence'):
            p['heure_presence'] = str(p['heure_presence'])
        # Le formatage de heure_depart a été rendu plus robuste
        if p.get('heure_depart') is not None:
             p['heure_depart'] = str(p['heure_depart'])
            
    return jsonify(presences)


# --- NOUVELLE ROUTE POUR LES ACTIVITÉS RÉCENTES ---
@app.route('/api/presences/recentes', methods=['GET'])
def get_recent_presences():
    """Récupère les 10 dernières entrées de présence, y compris le nom de l'utilisateur."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    query = """
    SELECT 
        p.date_presence,
        p.heure_arrivee,
        p.type_utilisateur,
        p.statut_arrivee,
        CASE
            WHEN p.type_utilisateur = 'enseignant' THEN e.nom
            WHEN p.type_utilisateur = 'etudiant' THEN t.nom
            ELSE 'Utilisateur Inconnu'
        END AS nom_utilisateur
    FROM presences p
    LEFT JOIN enseignants e ON p.utilisateur_id = e.id AND p.type_utilisateur = 'enseignant'
    LEFT JOIN etudiants t ON p.utilisateur_id = t.id AND p.type_utilisateur = 'etudiant'
    ORDER BY p.date_presence DESC, p.heure_arrivee DESC
    LIMIT 10;
    """
    
    try:
        cur.execute(query)
        data = cur.fetchall()
        return jsonify(data)
    except Exception as e:
        print(f"Erreur lors de la récupération des présences récentes: {e}")
        return jsonify({"error": "Erreur de base de données lors de la récupération des activités"}), 500
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    create_tables() # S'assure que les tables existent au démarrage
    app.run(debug=True, port=5001) # Le serveur s'exécute sur le port 5000