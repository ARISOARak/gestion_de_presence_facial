# Système de Gestion de Présence Faciale (UiUsers)

Application de **gestion de présence par reconnaissance faciale** destinée à un établissement universitaire. Elle permet d'inscrire des **étudiants** et des **enseignants**, de capturer plusieurs photos de visage via webcam, d'entraîner un **modèle d'intelligence artificielle (CNN)** sur ces photos, puis d'enregistrer automatiquement les présences d'entrée/sortie par simple scan du visage devant la caméra.

---

## ✨ Fonctionnalités

### 👩‍🎓 Inscription des utilisateurs
- Formulaire complet : nom, prénom, date de naissance, adresse, téléphone, email, CIN, matricule, rôle (étudiant / professeur), niveau (L1, L2, L3, M1, M2).
- Validation en temps réel des champs (formatage automatique, validation CSS/JS).

### 📸 Capture de photos faciale (entraînement)
- Ouverture de la webcam directement depuis le formulaire.
- **10 captures guidées** par personne (regarder droit, à gauche, à droite, sourire, etc.) afin de diversifier le jeu de données et améliorer la robustesse du modèle.
- Sauvegarde des photos dans des dossiers organisés par rôle puis par personne :
  `data/Etudiants/<NOM_Prenom>/` et `data/Enseignants/<NOM_Prenom>/`.

### 🧠 Intelligence Artificielle (modèle CNN)
- **Entraînement d'un réseau de neurones convolutif (CNN)** sur les photos collectées (`CNN.py`).
- **Augmentation de données** automatique (rotation, zoom, décalage, luminosité, retournement) pour généraliser le modèle même avec peu d'images.
- Génération de `entrainement.h5` (poids du modèle) et `labels.json` (correspondance classe → nom).
- **Ré-entraînement automatique** : le script surveille le dossier `data/` et relance l'entraînement dès qu'un changement (ajout/suppression de photos) est détecté.
- **Reconnaissance hybride** en fonctionnement : `face_recognition` (dlib, méthode principale, robuste) complétée par le **modèle CNN** (méthode de secours) avec un **seuil de confiance** configurable.

### ✅ Gestion des présences
- Choix du rôle (étudiant / enseignant) et du type (entrée / sortie).
- Reconnaissance faciale en direct via la webcam.
- Pour un enseignant : possibilité de saisir le titre du cours avant d'enregistrer.
- **Anti-doublon** : refus d'enregistrer une seconde présence pour la même personne le même jour.
- Enregistrement de l'heure d'arrivée (avec détection des **retards** au-delà d'une heure limite).

### 📊 Administration (tableau de bord)
- Interface d'espace admin sécurisée par authentification (email + mot de passe haché avec `flask-bcrypt`).
- **Statistiques** : nombre d'enseignants, d'étudiants, de présents/retards du jour.
- **CRUD complet** sur les enseignants et les étudiants (ajout, modification, suppression).
- **Historique des présences** et **graphiques** de taux de présence mensuel (Chart.js).

---

## 🏗️ Architecture du projet

Le projet est composé de **quatre couches** qui communiquent ensemble :

```
┌────────────────────────────┐
│  Frontend (Electron, HTML, │  index.html / board.html / admin.html
│  Bootstrap, JavaScript)    │  script.js / renderer.js
└────────────┬───────────────┘
             │ HTTP / IPC
┌────────────▼───────────────┐
│  Backend Flask (API REST)  │  apis.py / api.py (port 5001)
│  + serveur de photos       │  image.py (port 8081)
└────────────┬───────────────┘
             │ SQL
┌────────────▼───────────────┐
│  Base de données           │  PostgreSQL (base : pointage)
│  (enseignants, etudiants,  │
│   presences, admins)       │
└────────────────────────────┘
             │ Reconnaissance
┌────────────▼───────────────┐
│  Moteur IA (Python)        │  reconserv.py (port 5000)
│  - face_recognition        │  CNN.py (entraînement)
│  - Modèle CNN (TensorFlow) │  entrainement.h5
└────────────────────────────┘
```

### Les services
| Service | Fichier | Port | Rôle |
|---|---|---|---|
| Serveur de reconnaissance faciale | `reconserv.py` | 5000 | Endpoints de reconnaissance hybride, enregistrement de présence, données dashboard |
| API REST de gestion | `apis.py` / `api.py` | 5001 | CRUD enseignants / étudiants, auth admin, statistiques, présences |
| Serveur de sauvegarde d'images | `image.py` | 8081 | Reçoit les captures webcam et les range dans `data/` |
| Frontend Electron | `main.js` + `index.html` | — | Interface utilisateur principale |
| Entraînement CNN | `CNN.py` | — | Préparation du dataset, entraînement, surveillance automatique |

---

## 🤖 Le modèle CNN (détail)

### Architecture (`CNN.py → create_model`)
Un réseau convolutif séquentiel adapté à l'**entraînement sur CPU** (configuré avec `CUDA_VISIBLE_DEVICES=-1`) et aux petits jeux de données :

```
Conv2D(32) → BatchNorm → MaxPool → Dropout(0.25)
Conv2D(64) → BatchNorm → MaxPool → Dropout(0.30)
Conv2D(128) → BatchNorm → MaxPool → Dropout(0.40)
Flatten → Dense(256, relu) → Dropout(0.50) → Dense(num_classes, softmax)
```

- **Régularisation L2** (`kernel_regularizer=l2(0.001)`) sur chaque couche convolutive et dense pour limiter le surapprentissage.
- Optimiseur **Adam**, fonction de perte **categorical_crossentropy**.
- **Entrée** : images 100×100 pixels en RGB, normalisées (pixels / 255).
- **Sortie** : distribution de probabilité sur toutes les classes (une classe = une personne).

### Augmentation des données
`ImageDataGenerator` applique à chaque époque :
- rotation jusqu'à 30–40°,
- décalage horizontal / vertical (+ 20–30 %),
- zoom (+ 30–40 %),
- retournement horizontal (horizontal_flip),
- variation de luminosité (0.6 → 1.4),
- shear, fill_mode `nearest`.

### Apprentissage supervisé
- Split automatique **80 % entraînement / 20 % validation**.
- **EarlyStopping** (patience 10 époques) pour stopper quand la validation stagne.
- **ModelCheckpoint** : sauvegarde le meilleur modèle (`entrainement.h5`) sur la meilleure `val_accuracy`.
- **Ré-entraînement automatique** toutes les 60 s si de nouvelles photos apparaissent dans `data/`.

### Prédiction
`predict_with_cnn()` prétraite l'image (redimensionnement 100×100, normalisation), récupère la probabilité maximale (`np.argmax`) et la confiance associée (`np.max`). Le rôle (Étudiant/Enseignant) est déduit du nom de la classe.

### Reconnaissance hybride (`hybrid_recognition` dans `reconserv.py`)
1. **Méthode principale** : `face_recognition` (encodages 128-D via dlib). Si la confiance > 0.6 → résultat renvoyé.
2. **Méthode de secours** : modèle CNN. Si confiance > seuil (`0.7` par défaut) → résultat renvoyé.
3. **Fallback** : si aucune des deux ne dépasse le seuil, renvoie le meilleur résultat avec un avertissement.

---

## 🗄️ Base de données (PostgreSQL)

Base : `pointage` — tables principales :

| Table | Colonnes principales |
|---|---|
| `enseignants` | id, nom, prenom, email, tel, matiere, mot_de_passe, face_encoding |
| `etudiants` | id, nom, prenom, code_permanent, classe/niveau, email, face_encoding |
| `presences` | id, utilisateur_id, type_utilisateur, date_presence, heure_arrivee, heure_depart, statut_arrivee (`present` / `retard` / `absent`) |
| `admins` | id, nom, email, mot_de_passe (haché bcrypt) |

Le schéma est fourni dans `pointagedb.sql` (uniquement pour PostgreSQL, **SQLite n'est pas utilisé par le code actif**).

---

## 📁 Structure du projet

```
UIUSERS/
├── main.js                  # Processus main Electron (fenêtre, IPC)
├── preload.js               # Pont sécurisé (contextBridge) vers l'interface
├── index.html               # Interface utilisateur (inscription, présence, aide)
├── board.html               # Tableau de bord admin (stats, graphiques)
├── admin.html               # Page de connexion admin
├── script.js                # Logique frontend (capture webcam, navigation, validation)
├── renderer.js              # Envoi de l'inscription depuis le formulaire
├── styles.css               # Styles de l'application
│
├── CNN.py                   # Architecture CNN, entraînement, surveillance (IA)
├── reconserv.py             # Serveur de reconnaissance faciale hybride (Flask, port 5000)
├── apis.py / api.py         # API REST de gestion (Flask, port 5001)
├── image.py                 # Serveur de sauvegarde des photos webcam (port 8081)
├── create_ppt.py            # Génération d'un PPT de présentation du projet
│
├── entrainement.h5          # Poids du modèle CNN entraîné
├── labels.json              # Mapping classe → nom (généré par CNN.py)
├── encodings*.pkl / pickle  # Encodages faciaux (face_recognition)
│
├── data/
│   ├── Etudiants/<Nom_Prenom>/   # Photos des étudiants
│   └── Enseignants/<Nom_Prenom>/ # Photos des enseignants
├── data_entrainement/       # Dataset aplati utilisé pour l'entraînement CNN
│
├── pointagedb.sql           # Script de création de la base PostgreSQL
├── package.json             # Dépendances npm (Electron, pg)
└── README.md
```

---

## 🚀 Installation et démarrage

### Prérequis
- **Node.js** (pour Electron)
- **Python 3** avec les bibliothèques : `flask`, `flask-cors`, `psycopg2`, `tensorflow`, `opencv-python`, `face_recognition`, `Pillow`, `numpy`, `flask-bcrypt`
- **PostgreSQL** (base `pointage` créée, avec les identifiants configurés dans les fichiers Python)
- Une **webcam**

### Base de données
Importez `pointagedb.sql` dans PostgreSQL ou laissez `apis.py` créer automatiquement les tables au démarrage (et adaptez les identifiants `DB_USER` / `DB_PASS` dans les fichiers Python si besoin).

### Démarrage
```bash
# 1. Frontend Electron (interface utilisateur)
npm install
npm start

# 2. Moteur de reconnaissance faciale (IA)
python reconserv.py

# 3. Backend API REST
python apis.py

# 4. Serveur de photos (webcam)
python image.py

# 5. (Optionnel) Premier entraînement du modèle CNN
python CNN.py
```

> `CNN.py` s'exécute en **boucle** : il entraîne le modèle au premier lancement (si `entrainement.h5` n'existe pas), puis surveille le dossier `data/` pour se ré-entraîner automatiquement à chaque nouvelle inscription.

---

## 🔁 Fonctionnement de bout en bout

1. **Inscription** : l'utilisateur remplit le formulaire, valide, puis prend **10 photos** guidées devant la webcam (envoyées au serveur `image.py`, stockées dans `data/`).
2. **Entraînement** : `CNN.py` détecte les nouvelles photos et **ré-entraîne** le modèle CNN ; les visages sont aussi rechargés côté `face_recognition` (`/reload_faces`).
3. **Présence** : l'utilisateur ouvre la page "Présences", choisit son rôle et le type entrée/sortie, puis active la caméra. Le frontend envoie l'image capturée à `reconserv.py` (`/reconnaissance_hybride`).
4. **Vérification** : le moteur hybride confirme l'identité (face_recognition + CNN) et, au-delà du seuil de confiance, enregistre la présence en base (anti-doublon journalier).
5. **Suivi** : l'admin consulte les statistiques, les présents/retards du jour et l'historique sur `board.html`.

---

## ⚠️ Notes et améliorations possibles

- Les identifiants PostgreSQL sont **en clair dans le code** (`apis.py`, `main.js`, `reconserv.py`) : à déplacer dans des variables d'environnement pour la production.
- Le modèle CNN est entraîné **sur CPU** ; un GPU accélérerait fortement l'entraînement (retirer `CUDA_VISIBLE_DEVICES=-1` et installer `tensorflow-gpu`).
- Il n'existe pas encore d'APK/mobile ni de paquet Electron autonome ; `main.js` inclut du code CRUD commenté utilisant `pg` qui peut être réactivé pour éliminer la dépendance à Flask côté CRUD.

---

## 📄 Licence

Projet universitaire (gestion de présence faciale) à usage pédagogique.