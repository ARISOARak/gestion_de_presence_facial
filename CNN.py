import os
import time
import shutil
import json
import numpy as np
import matplotlib.pyplot as plt

# ==== CONFIG ENVIRONNEMENT ====
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"  # Force le CPU
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'   # Masque messages info/avertissements TensorFlow

from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv2D, MaxPooling2D, Flatten, Dense, Dropout, BatchNormalization
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping
from tensorflow.keras.regularizers import l2

# === CONFIGURATION ===
RAW_DATA_DIR = "data"
FLATTENED_DIR = "data_entrainement"
MODEL_PATH = "entrainement.h5"
LABELS_PATH = "labels.json"
IMG_SIZE = (100, 100)
BATCH_SIZE = 32
EPOCHS = 100
CHECK_INTERVAL = 60

# === 1. Organisation du dataset ===
def flatten_dataset():
    if not os.path.exists(FLATTENED_DIR):
        os.makedirs(FLATTENED_DIR)

    # Supprimer anciens dossiers
    for root, dirs, files in os.walk(FLATTENED_DIR):
        for d in dirs:
            shutil.rmtree(os.path.join(root, d))

    # Copier toutes les images dans un dossier plat
    for category in ["Etudiants", "Enseignants"]:
        category_path = os.path.join(RAW_DATA_DIR, category)
        if not os.path.exists(category_path):
            continue

        for person_name in os.listdir(category_path):
            person_path = os.path.join(category_path, person_name)
            if os.path.isdir(person_path):
                dest_dir = os.path.join(FLATTENED_DIR, person_name)
                os.makedirs(dest_dir, exist_ok=True)

                for img_file in os.listdir(person_path):
                    if img_file.lower().endswith(('.jpg', '.jpeg', '.png')):
                        shutil.copy2(os.path.join(person_path, img_file), os.path.join(dest_dir, img_file))

    print(f" Dataset préparé dans '{FLATTENED_DIR}'")

# === 2. Modèle CNN amélioré ===
def create_model(input_shape, num_classes):
    model = Sequential([
        Conv2D(32, (3,3), activation='relu', kernel_regularizer=l2(0.001), input_shape=input_shape),
        BatchNormalization(),
        MaxPooling2D(2,2),
        Dropout(0.25),

        Conv2D(64, (3,3), activation='relu', kernel_regularizer=l2(0.001)),
        BatchNormalization(),
        MaxPooling2D(2,2),
        Dropout(0.3),

        Conv2D(128, (3,3), activation='relu', kernel_regularizer=l2(0.001)),
        BatchNormalization(),
        MaxPooling2D(2,2),
        Dropout(0.4),

        Flatten(),
        Dense(256, activation='relu', kernel_regularizer=l2(0.001)),
        Dropout(0.5),
        Dense(num_classes, activation='softmax')
    ])
    model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
    return model

# === 3. Chargement avec augmentation forte ===
def load_data():
    datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=30,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.2,
        zoom_range=0.3,
        horizontal_flip=True,
        brightness_range=(0.6,1.4),
        validation_split=0.2
    )

    train_data = datagen.flow_from_directory(
        FLATTENED_DIR,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        subset='training',
        shuffle=True
    )

    val_data = datagen.flow_from_directory(
        FLATTENED_DIR,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        subset='validation'
    )

    return train_data, val_data

# === 4. Entraînement complet ===
def train_model():
    print(" Préparation des données...")
    flatten_dataset()
    train_data, val_data = load_data()
    num_classes = train_data.num_classes

    print(f" {num_classes} classes détectées : {list(train_data.class_indices.keys())}")

    model = create_model((*IMG_SIZE, 3), num_classes)

    checkpoint = ModelCheckpoint(MODEL_PATH, save_best_only=True, monitor='val_accuracy', mode='max')
    earlystop = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)

    print(" Entraînement en cours...")
    history = model.fit(
        train_data,
        epochs=EPOCHS,
        validation_data=val_data,
        callbacks=[checkpoint, earlystop]
    )

    print(f" Modèle sauvegardé dans : {MODEL_PATH}")
    with open(LABELS_PATH, "w") as f:
        json.dump(train_data.class_indices, f)
    print(f" Labels sauvegardés dans : {LABELS_PATH}")

    # Affichage graphique
    plt.figure(figsize=(8,5))
    plt.plot(history.history['accuracy'], label='Training')
    plt.plot(history.history['val_accuracy'], label='Validation')
    plt.title("Évolution de la précision")
    plt.xlabel("Époques")
    plt.ylabel("Précision")
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.show()

# === 5. Surveillance automatique ===
def get_all_image_paths():
    return {os.path.join(root, file)
            for root, dirs, files in os.walk(RAW_DATA_DIR)
            for file in files if file.lower().endswith(('.jpg', '.jpeg', '.png'))}

def watch_and_train():
    print(" Surveillance du dossier 'data/'...")
    last_snapshot = get_all_image_paths()

    while True:
        time.sleep(CHECK_INTERVAL)
        current_snapshot = get_all_image_paths()
        if current_snapshot != last_snapshot:
            print(" Changement détecté, ré-entraînement...")
            train_model()
            last_snapshot = current_snapshot
        else:
            print(" Aucun changement détecté, attente...")

def predict_with_cnn(image):
    """
    Utilise le modèle CNN pour prédire l'identité sur une image
    """
    global cnn_model, cnn_labels  # <-- Move global declaration here
    
    if cnn_model is None:
        # Charger le modèle CNN si ce n'est pas déjà fait
        try:
            from tensorflow.keras.models import load_model
            from tensorflow.keras.preprocessing.image import img_to_array
            
            cnn_model = load_model("entrainement.h5")
            with open("labels.json", 'r') as f:
                cnn_labels = json.load(f)
            print(f"[✔] Modèle CNN chargé avec {len(cnn_labels)} classes")
        except Exception as e:
            print(f"[❌] Erreur lors du chargement du modèle CNN: {e}")
            return None, None, 0
    
    try:
        # Prétraiter l'image pour le modèle CNN
        img = image.resize((100, 100))  # Taille attendue par le modèle
        img_array = img_to_array(img) / 255.0  # Normalisation
        img_array = np.expand_dims(img_array, axis=0)  # Ajouter dimension batch
        
        # Prédiction
        predictions = cnn_model.predict(img_array, verbose=0)
        confidence = np.max(predictions)
        class_index = np.argmax(predictions)
        
        # Trouver le nom correspondant à l'index
        for name, idx in cnn_labels.items():
            if idx == class_index:
                # Déterminer le rôle basé sur le nom ou d'autres critères
                role = "Etudiant"  # Par défaut
                if "enseignant" in name.lower() or "prof" in name.lower():
                    role = "Enseignant"
                return name, role, confidence
        
        return None, None, confidence
        
    except Exception as e:
        print(f"Erreur lors de la prédiction CNN: {e}")
        return None, None, 0


# Ajoutez cette fonction dans CNN.py
def enhance_training():
    """Améliore l'entraînement avec des techniques avancées"""
    # Augmentation des données plus agressive
    datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=40,
        width_shift_range=0.3,
        height_shift_range=0.3,
        shear_range=0.3,
        zoom_range=0.4,
        horizontal_flip=True,
        vertical_flip=True,
        brightness_range=(0.5, 1.5),
        fill_mode='nearest',
        validation_split=0.2
    )
    
    # Chargement des données
    train_data = datagen.flow_from_directory(
        FLATTENED_DIR,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        subset='training'
    )
    
    # Callbacks supplémentaires
    reduce_lr = ReduceLROnPlateau(monitor='val_loss', factor=0.2, patience=5, min_lr=0.0001)
    
    # Entraînement
    history = model.fit(
        train_data,
        epochs=EPOCHS,
        validation_data=val_data,
        callbacks=[checkpoint, earlystop, reduce_lr]
    )

# === Main ===
if __name__ == "__main__":
    if not os.path.exists(MODEL_PATH):
        print(" Premier entraînement...")
        train_model()
    watch_and_train()
