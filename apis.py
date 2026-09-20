# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import date, time, datetime, timedelta
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
    conn = None
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            host=DB_HOST,
            port=DB_PORT
        )
        return conn
    except psycopg2.OperationalError as e:
        print(f"Erreur de connexion à la base de données : {e}")
        # En production, vous voudriez logger cela et ne pas exposer l'erreur directement
        return None

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
            mot_de_passe VARCHAR(255) NOT NULL,
            face_encoding TEXT
        )
        """,
        # 2. Table des Étudiants
        """
        CREATE TABLE IF NOT EXISTS etudiants (
            id SERIAL PRIMARY KEY,
            nom VARCHAR(255) NOT NULL,
            code_permanent VARCHAR(50) UNIQUE NOT NULL,
            classe VARCHAR(100),
            face_encoding TEXT
        )
        """,
        # 3. Table des Présences
        """
        CREATE TABLE IF NOT EXISTS presences (
            id SERIAL PRIMARY KEY,
            utilisateur_id INTEGER NOT NULL,
            type_utilisateur VARCHAR(50) NOT NULL, -- 'etudiant' ou 'enseignant'
            date_presence DATE NOT NULL DEFAULT CURRENT_DATE,
            heure_arrivee TIME WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIME,
            heure_depart TIME WITHOUT TIME ZONE,
            statut_arrivee VARCHAR(50) NOT NULL, -- 'present', 'retard', 'absent'
            CONSTRAINT fk_utilisateur_check 
                CHECK (
                    (type_utilisateur = 'enseignant' AND EXISTS (SELECT 1 FROM enseignants WHERE enseignants.id = utilisateur_id)) OR
                    (type_utilisateur = 'etudiant' AND EXISTS (SELECT 1 FROM etudiants WHERE etudiants.id = utilisateur_id))
                )
        )
        """
    )
    conn = get_db_connection()
    if not conn:
        return
        
    try:
        cur = conn.cursor()
        for command in commands:
            cur.execute(command)
        cur.close()
        conn.commit()
    except (psycopg2.DatabaseError, Exception) as error:
        print(f"Erreur lors de la création des tables: {error}")
    finally:
        if conn is not None:
            conn.close()

# Appel à la création des tables au démarrage
create_tables()


# --- UTILS POUR LE FORMATAGE JSON ---
def format_presences(presences):
    """Convertit les objets date/time/timedelta en chaînes JSON sérialisables."""
    for p in presences:
        if p.get('date_presence') and isinstance(p['date_presence'], (date, datetime)):
            p['date_presence'] = p['date_presence'].isoformat()
        if p.get('heure_arrivee') and isinstance(p['heure_arrivee'], (time, timedelta)):
            p['heure_arrivee'] = str(p['heure_arrivee'])
        if p.get('heure_depart') is not None and isinstance(p['heure_depart'], (time, timedelta)):
            p['heure_depart'] = str(p['heure_depart'])
    return presences

# --- CRUD ENSEIGNANTS ---

@app.route('/api/enseignants', methods=['GET'])
def get_enseignants():
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Connexion DB échouée"}), 500
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT id, nom, email, matiere, face_encoding FROM enseignants ORDER BY nom")
        enseignants = cur.fetchall()
        return jsonify(enseignants)
    except Exception as e:
        print(f"Erreur lors de la récupération des enseignants: {e}")
        return jsonify({"error": "Erreur SQL"}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/enseignants', methods=['POST'])
def add_enseignant():
    data = request.get_json()
    nom = data.get('nom')
    email = data.get('email')
    matiere = data.get('matiere')
    password = data.get('mot_de_passe')
    face_encoding = data.get('face_encoding')

    if not all([nom, email, password]):
        return jsonify({"message": "Nom, email et mot de passe sont requis"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Connexion DB échouée"}), 500
    cur = conn.cursor()
    
    try:
        cur.execute(
            "INSERT INTO enseignants (nom, email, matiere, mot_de_passe, face_encoding) VALUES (%s, %s, %s, %s, %s) RETURNING id;",
            (nom, email, matiere, hashed_password, face_encoding)
        )
        enseignant_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"message": "Enseignant ajouté", "id": enseignant_id}), 201
    except psycopg2.IntegrityError:
        conn.rollback()
        return jsonify({"message": "Cet email existe déjà"}), 409
    except Exception as e:
        conn.rollback()
        print(f"Erreur lors de l'ajout de l'enseignant: {e}")
        return jsonify({"error": "Erreur SQL"}), 500
    finally:
        cur.close()
        conn.close()

# --- CRUD ETUDIANTS ---

@app.route('/api/etudiants', methods=['GET'])
def get_etudiants():
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Connexion DB échouée"}), 500
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT id, nom, code_permanent, classe, face_encoding FROM etudiants ORDER BY nom")
        etudiants = cur.fetchall()
        return jsonify(etudiants)
    except Exception as e:
        print(f"Erreur lors de la récupération des étudiants: {e}")
        return jsonify({"error": "Erreur SQL"}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/etudiants', methods=['POST'])
def add_etudiant():
    data = request.get_json()
    nom = data.get('nom')
    code_permanent = data.get('code_permanent')
    classe = data.get('classe')
    face_encoding = data.get('face_encoding')

    if not all([nom, code_permanent, classe]):
        return jsonify({"message": "Nom, code permanent et classe sont requis"}), 400
    
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Connexion DB échouée"}), 500
    cur = conn.cursor()
    
    try:
        cur.execute(
            "INSERT INTO etudiants (nom, code_permanent, classe, face_encoding) VALUES (%s, %s, %s, %s) RETURNING id;",
            (nom, code_permanent, classe, face_encoding)
        )
        etudiant_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"message": "Étudiant ajouté", "id": etudiant_id}), 201
    except psycopg2.IntegrityError:
        conn.rollback()
        return jsonify({"message": "Ce code permanent existe déjà"}), 409
    except Exception as e:
        conn.rollback()
        print(f"Erreur lors de l'ajout de l'étudiant: {e}")
        return jsonify({"error": "Erreur SQL"}), 500
    finally:
        cur.close()
        conn.close()


# --- ROUTES DE GESTION DE PRÉSENCE ---

@app.route('/api/presences/register', methods=['POST'])
def register_presence():
    """
    Enregistre la présence d'un utilisateur.
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
    if conn is None: return jsonify({"error": "Connexion DB échouée"}), 500
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
            INSERT INTO presences (utilisateur_id, type_utilisateur, statut_arrivee, heure_arrivee)
            VALUES (%s, %s, %s, CURRENT_TIME);
            """,
            (utilisateur_id, type_utilisateur, statut_arrivee)
        )
        conn.commit()
        return jsonify({"message": "Présence enregistrée avec succès.", "id": utilisateur_id}), 201
        
    except Exception as e:
        conn.rollback()
        print(f"Erreur lors de l'enregistrement de la présence: {e}")
        return jsonify({"message": "Erreur serveur lors de l'enregistrement."}), 500
        
    finally:
        cur.close()
        conn.close()


@app.route('/api/presences', methods=['GET'])
def get_presences():
    """
    Récupère toutes les entrées de présence avec les noms des utilisateurs associés.
    """
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Connexion DB échouée"}), 500
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    query = """
    SELECT 
        p.id,
        CASE 
            WHEN p.type_utilisateur = 'enseignant' THEN e.nom
            WHEN p.type_utilisateur = 'etudiant' THEN t.nom
            ELSE 'Utilisateur inconnu'
        END AS nom_utilisateur,
        p.type_utilisateur,
        p.date_presence, 
        p.heure_arrivee,
        p.heure_depart,
        p.statut_arrivee
    FROM presences p
    LEFT JOIN enseignants e ON p.utilisateur_id = e.id AND p.type_utilisateur = 'enseignant'
    LEFT JOIN etudiants t ON p.utilisateur_id = t.id AND p.type_utilisateur = 'etudiant'
    ORDER BY p.date_presence DESC, p.heure_arrivee DESC;
    """
    
    try:
        cur.execute(query)
        presences = cur.fetchall()
        return jsonify(format_presences(presences))
    except Exception as e:
        print(f"Erreur lors de l'exécution de la requête presences: {e}")
        return jsonify({"error": "Erreur SQL lors de la récupération des présences"}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/api/presences/recentes', methods=['GET'])
def get_recent_presences():
    """Récupère les 10 dernières entrées de présence, y compris le nom de l'utilisateur."""
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Connexion DB échouée"}), 500
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
        return jsonify(format_presences(data))
    except Exception as e:
        print(f"Erreur lors de la récupération des présences récentes: {e}")
        return jsonify({"error": "Erreur de base de données lors de la récupération des activités"}), 500
    finally:
        cur.close()
        conn.close()

# --- ROUTES DE STATISTIQUES ---

@app.route('/api/stats/globales', methods=['GET'])
def get_global_stats():
    """Récupère les statistiques clés pour le tableau de bord."""
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Connexion DB échouée"}), 500
    cur = conn.cursor()
    
    stats = {}
    try:
        # 1. Total Enseignants et Étudiants
        cur.execute("SELECT COUNT(*) FROM enseignants;")
        stats['total_enseignants'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM etudiants;")
        stats['total_etudiants'] = cur.fetchone()[0]
        
        # 2. Présences Aujourd'hui (Arrivée enregistrée)
        cur.execute("SELECT COUNT(*) FROM presences WHERE date_presence = CURRENT_DATE AND statut_arrivee IN ('present', 'retard');")
        stats['presences_aujourdhui'] = cur.fetchone()[0]
        
        # 3. Total des enregistrements de présence (historique)
        cur.execute("SELECT COUNT(*) FROM presences;")
        stats['total_presences_enregistrees'] = cur.fetchone()[0]
        
    except (Exception, psycopg2.Error) as error:
        print(f"Erreur lors de la récupération des stats: {error}")
        return jsonify({"error": "Erreur de base de données"}), 500
    finally:
        cur.close()
        conn.close()
        
    return jsonify(stats)

@app.route('/api/stats/monthly_attendance', methods=['GET'])
def get_monthly_attendance():
    """Calcule le taux de présence mensuel."""
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Connexion DB échouée"}), 500
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Calcule le total d'entrées et le total de présences (incluant retards) par mois
    query = """
    SELECT
        TO_CHAR(date_presence, 'YYYY-MM') AS month_key,
        TO_CHAR(date_presence, 'Mon YYYY') AS month,
        ROUND(
            CAST(COUNT(CASE WHEN statut_arrivee IN ('present', 'retard') THEN 1 END) AS NUMERIC) / 
            CAST(COUNT(*) AS NUMERIC) * 100
        , 2) AS presence_rate
    FROM presences
    GROUP BY month_key, month
    ORDER BY month_key;
    """
    
    try:
        cur.execute(query)
        data = cur.fetchall()
        return jsonify(data)
    except Exception as e:
        print(f"Erreur lors de la récupération des stats de présence mensuelles: {e}")
        return jsonify({"error": "Erreur de base de données"}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/stats/top_retards', methods=['GET'])
def get_top_retards():
    """Récupère les 5 utilisateurs ayant le plus de retards."""
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Connexion DB échouée"}), 500
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Calcule le nombre de retards par utilisateur (Enseignant et Étudiant)
    query = """
    WITH Retards AS (
        SELECT
            utilisateur_id,
            type_utilisateur,
            COUNT(*) as retard_count
        FROM presences
        WHERE statut_arrivee = 'retard'
        GROUP BY utilisateur_id, type_utilisateur
    )
    SELECT 
        r.retard_count,
        CASE
            WHEN r.type_utilisateur = 'enseignant' THEN e.nom
            WHEN r.type_utilisateur = 'etudiant' THEN t.nom
            ELSE 'Inconnu'
        END AS nom_utilisateur
    FROM Retards r
    LEFT JOIN enseignants e ON r.utilisateur_id = e.id AND r.type_utilisateur = 'enseignant'
    LEFT JOIN etudiants t ON r.utilisateur_id = t.id AND r.type_utilisateur = 'etudiant'
    ORDER BY r.retard_count DESC
    LIMIT 5;
    """
    
    try:
        cur.execute(query)
        data = cur.fetchall()
        return jsonify(data)
    except Exception as e:
        print(f"Erreur lors de la récupération du Top Retards: {e}")
        return jsonify({"error": "Erreur de base de données"}), 500
    finally:
        cur.close()
        conn.close()


# --- ROUTE DE TEST (À SUPPRIMER EN PRODUCTION) ---
@app.route('/api/test/insert_presences', methods=['POST'])
def insert_test_presences():
    """
    Insère des entrées de présence factices pour le test.
    CETTE ROUTE SUPPOSE QUE VOUS AVEZ DÉJÀ UN ENSEIGNANT (ID 1) ET UN ÉTUDIANT (ID 2).
    """
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Connexion DB échouée"}), 500
    cur = conn.cursor()
    
    test_data = [
        # Etudiant 2, Présent, Hier
        (2, 'etudiant', 'present', date.today() - timedelta(days=1), time(8, 0, 0), time(16, 0, 0)),
        # Enseignant 1, Retard, Aujourd'hui
        (1, 'enseignant', 'retard', date.today(), time(8, 35, 0), None),
        # Etudiant 2, Absent, Aujourd'hui (simulé)
        (2, 'etudiant', 'absent', date.today(), time(7, 50, 0), None),
        # Etudiant 2, Présent, Mois dernier (pour les stats mensuelles)
        (2, 'etudiant', 'present', date.today() - timedelta(days=35), time(8, 0, 0), None),
        # Enseignant 1, Présent, Mois dernier
        (1, 'enseignant', 'present', date.today() - timedelta(days=32), time(7, 50, 0), time(12, 0, 0)),
    ]
    
    try:
        cur.execute("SELECT COUNT(*) FROM presences")
        if cur.fetchone()[0] > 100: # Limite pour éviter de surcharger
             return jsonify({"message": "Trop de données de test existent déjà (max 100). Test annulé."}), 200

        for utilisateur_id, type_utilisateur, statut, d, h_arr, h_dep in test_data:
            cur.execute(
                """
                INSERT INTO presences 
                (utilisateur_id, type_utilisateur, statut_arrivee, date_presence, heure_arrivee, heure_depart)
                VALUES (%s, %s, %s, %s, %s, %s);
                """,
                (utilisateur_id, type_utilisateur, statut, d, h_arr, h_dep)
            )
        conn.commit()
        return jsonify({"message": f"{len(test_data)} entrées de présence de test insérées avec succès."}), 201
    
    except Exception as e:
        conn.rollback()
        print(f"Erreur lors de l'insertion de test: {e}")
        return jsonify({"message": "Erreur lors de l'insertion des données de test (vérifiez que les utilisateurs ID 1 et 2 existent).", "error": str(e)}), 500
        
    finally:
        cur.close()
        conn.close()

# Point d'entrée de l'application
# if __name__ == '__main__':
#     app.run(debug=True)
