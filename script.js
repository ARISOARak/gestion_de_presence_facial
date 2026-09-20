// ------------------------------
// Gestion du chargement et sélection de fichier via input[type=file]
// ------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const btnOpenFolder = document.getElementById('btn-open-folder');
  const fileInput = document.getElementById('fileInput');

  if (btnOpenFolder && fileInput) {
    // Quand on clique sur le bouton, on déclenche le sélecteur de fichier
    btnOpenFolder.addEventListener('click', () => {
      fileInput.value = ''; // Réinitialise la sélection pour pouvoir choisir le même fichier plusieurs fois
      fileInput.click();
    });

    // Quand un fichier est sélectionné
    fileInput.addEventListener('change', (event) => {
      const files = event.target.files;
      if (files.length > 0) {
        console.log('Fichier sélectionné:', files[0].name);

        // Si c'est une image, afficher un aperçu dans une balise <img> avec id "preview"
        if (files[0].type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = e => {
            const preview = document.getElementById('preview');
            if (preview) preview.src = e.target.result;
          };
          reader.readAsDataURL(files[0]);
        }
      }
    });
  }
});

// ------------------------------
// Navigation entre écrans
// ------------------------------
const navItems = document.querySelectorAll('.nav-item');
const navBtns = document.querySelectorAll('.nav-btn');
const screens = document.querySelectorAll('.screen');

/**
 * Active un écran et désactive les autres,
 * met à jour la classe active sur les boutons liés.
 * @param {string} screenId - id de l'écran à afficher
 */
function switchScreen(screenId) {
  // Désactive tous les écrans
  screens.forEach(screen => screen.classList.remove('active'));
  // Active l'écran cible
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) targetScreen.classList.add('active');

  // Désactive tous les boutons nav
  navItems.forEach(btn => btn.classList.remove('active'));
  navBtns.forEach(btn => btn.classList.remove('active'));

  // Active tous les boutons liés à cet écran (via attribut data-screen)
  document.querySelectorAll(`[data-screen="${screenId}"]`).forEach(el => el.classList.add('active'));
}

// Ajoute l'écoute d'événement sur les boutons nav
navItems.forEach(btn => {
  btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
});
navBtns.forEach(btn => {
  btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
});

// ------------------------------
// Affichage conditionnel du champ "niveau" selon rôle sélectionné
// ------------------------------
const roleSelect = document.getElementById('role');
const niveauContainer = document.getElementById('niveau-container');

if (roleSelect && niveauContainer) {
  // Affiche ou cache le champ niveau selon rôle
  roleSelect.addEventListener('change', () => {
    niveauContainer.style.display = (roleSelect.value === 'etudiant') ? 'block' : 'none';
  });

  // Initialisation au chargement
  if (roleSelect.value !== 'etudiant') {
    niveauContainer.style.display = 'none';
  }
}

// ------------------------------
// Simulation d'un bouton de capture (ex: pour tests)
// ------------------------------
const captureBtn = document.getElementById('capture-btn');
if (captureBtn) {
  captureBtn.addEventListener('click', () => {
    // Note: Utiliser une modale au lieu d'une alerte
    alert("Capture simulée !");
  });
}

// ------------------------------
// Animation texte couleur vague pour footer
// ------------------------------
const footerTexts = document.querySelectorAll('.animated-footer-text');
const colorWaves = [
  ['#FF0000', '#ffffff', '#00FFFF'], // rouge, blanc, cyan
  ['#00FFFF', '#800080', '#FFA500'], // cyan, violet, orange
  ['#00FFFF', '#FF1493', '#FFFF00'], // cyan, rose, jaune
  ['#008000', '#FFD700', '#4B0082'], // vert, or, indigo
  ['#FF4500', '#1E90FF', '#7CFC00'], // orange foncé, bleu, vert clair
  ['#8A2BE2', '#00CED1', '#FF69B4']  // violet, turquoise, rose clair
];
let waveIndex = 0;

/**
 * Applique une animation de couleur vague sur le texte footer
 */
function applyWaveColors() {
  footerTexts.forEach(el => {
    const text = el.textContent;
    const partLen = Math.ceil(text.length / 3);
    const wave = colorWaves[waveIndex % colorWaves.length];
    let html = '';

    for (let i = 0; i < text.length; i++) {
      let color;
      if (i < partLen) color = wave[0];
      else if (i < partLen * 2) color = wave[1];
      else color = wave[2];
      html += `<span style="color: ${color}">${text[i]}</span>`;
    }
    el.innerHTML = html;
  });
  waveIndex++;
}
// Démarrage animation au chargement + intervalle toutes les secondes
applyWaveColors();
setInterval(applyWaveColors, 1000);

// ------------------------------
// Gestion capture photo via webcam avec instructions et sauvegarde serveur
// ------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  const btnOpen = document.getElementById("btn-open-camera");
  const modalElement = document.getElementById("cameraModal");
  const instruction = document.getElementById("instruction");
  const video = document.getElementById("webcam-video");
  const canvas = document.getElementById("snapshot-canvas");
  const btnCapture = document.getElementById("capture-photo");
  const statusDiv = document.getElementById("status");
  const closeCameraBtn = document.getElementById("close-camera");

  // Instructions à suivre lors des captures (10 au total)
  const instructions = [
    "Regardez droit devant",
    "Regardez légèrement à gauche",
    "Regardez légèrement à droite",
    "Levez légèrement la tête",
    "Baissez légèrement la tête",
    "Faites un sourire",
    "Ouvrez la bouche doucement",
    "Fermez les yeux une seconde",
    "Tournez le visage à gauche",
    "Tournez le visage à droite"
  ];

  let compteur = 0;
  let stream = null;
  // Assurez-vous d'avoir Bootstrap 5 pour utiliser la classe Modal
  const bootstrapModal = new bootstrap.Modal(modalElement);
  
  // Correction ici : utilisez la longueur du tableau d'instructions
  const TOTAL_CAPTURES = instructions.length; 

  // Ouvre la webcam et affiche modal
  btnOpen.addEventListener("click", async () => {
    bootstrapModal.show();
    compteur = 0;
    updateInstruction();
    statusDiv.innerHTML = "";
    btnCapture.disabled = false;

    try {
      // Utiliser la webcam par défaut du PC
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user" 
        } 
      });
      
      statusDiv.textContent = "Webcam locale activée.";
      video.srcObject = stream;
    } catch (e) {
      console.error("Erreur d'accès à la caméra:", e);
      statusDiv.textContent = "Erreur : Impossible d'accéder à la caméra. Vérifiez les permissions.";
      alert("Erreur : Impossible d'accéder à la caméra.");
    }
  });

  // Capture photo sur clic bouton
  btnCapture.addEventListener("click", () => {
    // Le test de fin de capture doit utiliser la nouvelle variable
    if (compteur >= TOTAL_CAPTURES) {
      instruction.textContent = "✅ Toutes les captures sont terminées.";
      btnCapture.disabled = true;
      setTimeout(() => bootstrapModal.hide(), 1500);
      return;
    }
    captureImage();
  });

  // Capture l'image, l'envoie au serveur et met à jour l'instruction
  async function captureImage() {
    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL("image/png");

    const nom = document.getElementById("nom").value.trim();
    const prenom = document.getElementById("prenom").value.trim();
    const role = document.getElementById("role").value.trim();

    // Vérification que les champs essentiels sont remplis
    if (!nom || !prenom || !role) {
      alert("Veuillez remplir les champs nom, prénom et rôle avant la capture.");
      bootstrapModal.hide();
      return;
    }

    try {
      const response = await fetch("http://localhost:8081/sauvegarder-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom,
          prenom,
          role,
          image: imageData,
          index: compteur
        })
      });

      if (response.ok) {
        // Mettre à jour le statut avec le nombre total de captures
        statusDiv.textContent = `✅ Image ${compteur + 1}/${TOTAL_CAPTURES} enregistrée avec succès.`;
      } else {
        statusDiv.textContent = `❌ Échec de l'enregistrement image ${compteur + 1}`;
      }
    } catch (err) {
      console.error("Erreur lors de l'envoi :", err);
      statusDiv.textContent = `❌ Erreur lors de la capture ${compteur + 1}`;
    }

    compteur++;
    updateInstruction();

    // Le test de fin de capture doit utiliser la nouvelle variable
    if (compteur >= TOTAL_CAPTURES) {
      instruction.textContent = "✅ Toutes les captures sont terminées.";
      btnCapture.disabled = true;
      setTimeout(() => bootstrapModal.hide(), 1500);
    }
  }

  // Met à jour le texte de l'instruction en cours
  function updateInstruction() {
    if (compteur < TOTAL_CAPTURES) {
      instruction.textContent = `Étape ${compteur + 1}/${TOTAL_CAPTURES} : ${instructions[compteur]}`;
    }
  }

  // Nettoyage à la fermeture de la modal : arrêt webcam et reset
  modalElement.addEventListener("hidden.bs.modal", () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    compteur = 0;
    instruction.textContent = "";
    statusDiv.innerHTML = "";
    btnCapture.disabled = false;
  });

  // Fermer la caméra avec le bouton de fermeture
  if (closeCameraBtn) {
    closeCameraBtn.addEventListener("click", () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      bootstrapModal.hide();
    });
  }
});

// ------------------------------
// Gestion du menu drawer footer
// ------------------------------
const menuBtn = document.getElementById("menuBtn");
    if (menuBtn) {
        const drawerPopup = document.createElement("div");
        drawerPopup.classList.add("drawer-popup");
        drawerPopup.innerHTML = `
            <button class="nav-item" data-screen="dashboard"><i class="material-icons">home</i>Accueil</button>
            <button class="nav-item" data-screen="inscription"><i class="material-icons">person_add</i>Inscription</button>
            <button class="nav-item" data-screen="presence"><i class="material-icons">calendar_today</i>Présences</button>
            <button class="nav-item" data-screen="settings"><i class="material-icons">help</i>Aide</button>
        `;
        document.body.appendChild(drawerPopup);

        menuBtn.addEventListener("click", () => {
            drawerPopup.classList.toggle("show");
        });

        document.querySelectorAll('.drawer-popup .nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                switchScreen(btn.dataset.screen);
                drawerPopup.classList.remove("show");
            });
        });
    }

// ------------------------------
// Notifications popup sur sidebar selon écran actif
// ------------------------------
const notif = document.getElementById('sidebarNotification');
    const allNavButtons = document.querySelectorAll('.nav-item, .nav-btn, .drawer-popup .nav-item');

    const messages = {
        dashboard: "Vous êtes dans la page d'Accueil",
        inscription: "Vous êtes dans la page d'Inscription",
        presence: "Vous êtes dans la page de Présence",
        settings: "Vous êtes dans la page d'Aide"
    };

    allNavButtons.forEach(button => {
        button.addEventListener('click', () => {
            const screenId = button.getAttribute('data-screen');
            if (notif) {
                notif.textContent = messages[screenId] || "Page inconnue";
                notif.classList.add('show');
                setTimeout(() => {
                    notif.classList.remove('show');
                }, 4000);
            }
        });
    });
// ------------------------------
// Validation et formatage des inputs du formulaire inscription
// ------------------------------

// Met en majuscule tout le contenu d'un input (ex: nom)
function toUpperCaseInput(input) {
  input.value = input.value.toUpperCase();
}

// Capitalise la première lettre de chaque mot dans une chaîne (ex: prénom, adresse)
function capitalizeWords(str) {
  return str.replace(/\b\w+/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-inscription');

  const nom = document.getElementById('nom');
  const prenom = document.getElementById('prenom');
  const adresse = document.getElementById('adresse');
  const tel = document.getElementById('tel');
  const email = document.getElementById('email');
  const cin = document.getElementById('cin');
  const matricule = document.getElementById('matricule');
  const role = document.getElementById('role');
  const niveau = document.getElementById('niveau');

  const errorNom = document.getElementById('error-nom');
  const errorPrenom = document.getElementById('error-prenom');
  const errorAdresse = document.getElementById('error-adresse');
  const errorTel = document.getElementById('error-tel');
  const errorEmail = document.getElementById('error-email');
  const errorCin = document.getElementById('error-cin');
  const errorMatricule = document.getElementById('error-matricule');
  const errorRole = document.getElementById('error-role');

  // Validation et formatage Nom (tout majuscule)
  nom.addEventListener('input', () => {
    toUpperCaseInput(nom);
    if (/^[A-Z\s-]+$/.test(nom.value)) {
      nom.classList.remove('is-invalid');
      errorNom.style.display = 'none';
    } else {
      nom.classList.add('is-invalid');
      errorNom.style.display = 'block';
    }
  });

  // Validation et formatage Prénom (capitalize chaque mot)
  prenom.addEventListener('input', () => {
    const val = capitalizeWords(prenom.value);
    if (prenom.value !== val) prenom.value = val;

    if (/^([A-Z][a-z]*)( [A-Z][a-z]*)*$/.test(prenom.value) || prenom.value === '') {
      prenom.classList.remove('is-invalid');
      errorPrenom.style.display = 'none';
    } else {
      prenom.classList.add('is-invalid');
      errorPrenom.style.display = 'block';
    }
  });

  // Validation et formatage Adresse (capitalize chaque mot)
  adresse.addEventListener('input', () => {
    const val = capitalizeWords(adresse.value);
    if (adresse.value !== val) adresse.value = val;

    if (/^([A-Z][a-z]*)( [A-Z][a-z]*)*$/.test(adresse.value) || adresse.value === '') {
      adresse.classList.remove('is-invalid');
      errorAdresse.style.display = 'none';
    } else {
      adresse.classList.add('is-invalid');
      errorAdresse.style.display = 'block';
    }
  });

  // Validation Téléphone : uniquement chiffres, longueur entre 7 et 15
  tel.addEventListener('input', () => {
    tel.value = tel.value.replace(/[^0-9]/g, ''); // supprime tout ce qui n'est pas chiffre
    if (/^[0-9]{7,15}$/.test(tel.value)) {
      tel.classList.remove('is-invalid');
      errorTel.style.display = 'none';
    } else {
      tel.classList.add('is-invalid');
      errorTel.style.display = 'block';
    }
  });

  // Validation CIN : uniquement chiffres, longueur entre 5 et 15
  cin.addEventListener('input', () => {
    cin.value = cin.value.replace(/[^0-9]/g, '');
    if (/^[0-9]{5,15}$/.test(cin.value)) {
      cin.classList.remove('is-invalid');
      errorCin.style.display = 'none';
    } else {
      cin.classList.add('is-invalid');
      errorCin.style.display = 'block';
    }
  });

  // Validation Email : native HTML5 + affichage erreur
  email.addEventListener('input', () => {
    if (email.validity.valid) {
      email.classList.remove('is-invalid');
      errorEmail.style.display = 'none';
    } else {
      email.classList.add('is-invalid');
      errorEmail.style.display = 'block';
    }
  });

  // Validation Matricule : champ obligatoire non vide
  matricule.addEventListener('input', () => {
    if (matricule.value.trim() === '') {
      matricule.classList.add('is-invalid');
      errorMatricule.style.display = 'block';
    } else {
      matricule.classList.remove('is-invalid');
      errorMatricule.style.display = 'none';
    }
  });

  // Validation Role : obligatoire (select non vide)
  role.addEventListener('change', () => {
    if (role.value === '') {
      role.classList.add('is-invalid');
      errorRole.style.display = 'block';
    } else {
      role.classList.remove('is-invalid');
      errorRole.style.display = 'none';
    }
  });

  // Soumission du formulaire avec validation globale
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Déclenche toutes les validations manuellement
    nom.dispatchEvent(new Event('input'));
    prenom.dispatchEvent(new Event('input'));
    adresse.dispatchEvent(new Event('input'));
    tel.dispatchEvent(new Event('input'));
    email.dispatchEvent(new Event('input'));
    cin.dispatchEvent(new Event('input'));
    matricule.dispatchEvent(new Event('input'));
    role.dispatchEvent(new Event('change'));

    // Recherche d'erreurs visibles
    const invalids = form.querySelectorAll('.is-invalid');
    if (invalids.length === 0) {
      alert('Formulaire validé avec succès !');
      // Ici, tu peux envoyer les données au serveur ou faire un autre traitement
      //form.reset();

      // Réinitialiser aussi affichage champ niveau si besoin
      if (niveauContainer) niveauContainer.style.display = 'none';
    } else {
      alert('Veuillez corriger les erreurs avant de valider.');
    }
  });

});



// ============================================================================================================
//                                     VARIABLES GLOBALES ET SÉLECTION DU DOM (Présences)
// ============================================================================================================
// const toggleCameraBtn = document.getElementById('toggle-camera-btn');
// const roleRadios = document.querySelectorAll('input[name="roleRadio"]');
// const presenceTypeRadios = document.querySelectorAll('input[name="presenceType"]');
// const presenceStatus = document.getElementById('presence-status');
// const faceOverlay = document.querySelector('.face-overlay');
// const cameraPlaceholder = document.querySelector('.camera-placeholder');
// const video = document.createElement('video');
// video.autoplay = true;
// video.playsinline = true;
// video.classList.add('w-100', 'rounded', 'border');
// const courseModal = document.getElementById('course-modal');
// const courseTitleInput = document.getElementById('course-title');
// const confirmCourseBtn = document.getElementById('confirm-course');
// const cancelCourseBtn = document.getElementById('cancel-course');

// // Variables pour la reconnaissance faciale de présence
// let streamPresence = null;
// let intervalIdPresence = null;
// let cameraActive = false;
// let currentRole = null;
// let currentType = null;

// // ============================================================================================================
// //                                     FONCTIONS DE RECONNAISSANCE FACIALE (PRÉSENCE)
// // ============================================================================================================

// /**
//  * Démarre le flux vidéo et la reconnaissance faciale de présence.
//  * @param {string} role - 'etudiant' ou 'enseignant'.
//  * @param {string} type - 'entry' ou 'exit'.
//  * @param {string|null} courseTitle - Le titre du cours, si applicable.
//  */
// async function startFacialRecognition(role, type, courseTitle = null) {
//     if (streamPresence) {
//         return;
//     }

//     try {
//         // Utiliser la webcam du PC (pas ivcam)
//         streamPresence = await navigator.mediaDevices.getUserMedia({ 
//             video: { 
//                 width: { ideal: 1280 },
//                 height: { ideal: 720 },
//                 facingMode: "user"  // Utilise la webcam frontale
//             } 
//         });
        
//         if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';
//         const cameraFeedContainer = document.querySelector('.camera-feed');
//         if (cameraFeedContainer) cameraFeedContainer.prepend(video);
//         video.srcObject = streamPresence;

//         const roleText = role === 'etudiant' ? 'Étudiant' : 'Enseignant';
//         const typeText = type === 'entry' ? 'entrée' : 'sortie';
//         let statusMessage = `Reconnaissance pour l'${roleText} (${typeText}) en cours...`;
//         if (courseTitle) {
//             statusMessage += ` - Cours: ${courseTitle}`;
//         }
//         updatePresenceStatus('info', statusMessage);
//         if (faceOverlay) faceOverlay.classList.add('scanning');
//         cameraActive = true;
//         toggleCameraBtn.innerHTML = '<i class="material-icons">videocam_off</i> Arrêter la reconnaissance';
//         toggleCameraBtn.classList.remove('btn-primary');
//         toggleCameraBtn.classList.add('btn-danger');

//         intervalIdPresence = setInterval(() => scanFace(role, type, courseTitle), 1500);

//     } catch (err) {
//         console.error("Erreur d'accès à la caméra: ", err);
//         updatePresenceStatus('error', 'Impossible d\'accéder à la caméra. Vérifiez les permissions.');
//     }
// }

// /**
//  * Arrête le flux vidéo et la détection faciale de présence.
//  */
// function stopFacialRecognition() {
//     if (streamPresence) {
//         streamPresence.getTracks().forEach(track => track.stop());
//         streamPresence = null;
//         clearInterval(intervalIdPresence);
//         video.srcObject = null;
//         if (video.parentNode) video.parentNode.removeChild(video);
//         if (cameraPlaceholder) cameraPlaceholder.style.display = 'flex';
//     }
//     if (faceOverlay) faceOverlay.classList.remove('scanning');
//     cameraActive = false;
//     if (toggleCameraBtn) {
//         toggleCameraBtn.innerHTML = '<i class="material-icons">videocam</i> Démarrer la reconnaissance';
//         toggleCameraBtn.classList.remove('btn-danger');
//         toggleCameraBtn.classList.add('btn-primary');
//     }
//     updatePresenceStatus('info', "Reconnaissance faciale arrêtée. Cliquez sur 'Démarrer la reconnaissance' pour activer la caméra");
// }

// /**
//  * Capture une image et l'envoie au serveur de reconnaissance.
//  * @param {string} role - Le rôle.
//  * @param {string} type - 'entry' ou 'exit'.
//  * @param {string|null} courseTitle - Le titre du cours, si applicable.
//  */
// async function scanFace(role, type, courseTitle = null) {
//   if (!video.videoWidth || !video.videoHeight) return;
//   const canvas = document.createElement('canvas');
//   canvas.width = video.videoWidth;
//   canvas.height = video.videoHeight;
//   const context = canvas.getContext('2d');
//   context.drawImage(video, 0, 0, canvas.width, canvas.height);

//   // Modification ici pour obtenir l'image en base64
//   const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
  
//   const payload = {
//       image: imageDataUrl,  // Envoyer le data URL complet
//       role: role,
//       type: type,  // Utiliser 'entry' ou 'exit' au lieu de 'entrer'/'sortir'
//       ...(courseTitle && { course_title: courseTitle })
//   };

//   try {
//       // Modification du port de 5001 à 5000
//       const response = await fetch('http://localhost:5000/reconnaissance', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify(payload)
//       });
      
//       if (!response.ok) {
//           throw new Error(`Erreur HTTP: ${response.status}`);
//       }
      
//       const data = await response.json();
//       updatePresenceStatus(data.status, data.message);
      
//       if (data.status === 'success' || data.status === 'warning') {
//           setTimeout(stopFacialRecognition, 3000);
//       }
//   } catch (error) {
//       console.error('Erreur de communication avec le serveur Flask :', error);
//       updatePresenceStatus('error', 'Erreur : Serveur de reconnaissance non disponible.');
//   }
// }
// /**
//  * Met à jour le message de statut sur la page de présence.
//  * @param {string} status - 'success', 'warning', ou 'error'.
//  * @param {string} message - Message à afficher.
//  */
// function updatePresenceStatus(status, message) {
//     if (!presenceStatus) return;
//     presenceStatus.textContent = message;
//     presenceStatus.classList.remove('text-success', 'text-warning', 'text-danger', 'text-info');
//     if (status === 'success') {
//         presenceStatus.classList.add('text-success');
//     } else if (status === 'warning') {
//         presenceStatus.classList.add('text-warning');
//     } else if (status === 'info') {
//         presenceStatus.classList.add('text-info');
//     } else {
//         presenceStatus.classList.add('text-danger');
//     }
// }






// ============================================================================================================
//                                     FONCTIONS DE RECONNAISSANCE FACIALE (PRÉSENCE)
// ============================================================================================================

/**
//  * Démarre le flux vidéo et la reconnaissance faciale de présence.
//  * @param {string} role - 'etudiant' ou 'enseignant'.
//  * @param {string} type - 'entry' ou 'exit'.
//  * @param {string|null} courseTitle - Le titre du cours, si applicable.
//  */
//  async function startFacialRecognition(role, type, courseTitle = null) {
//   if (streamPresence) {
//       return;
//   }

//   try {
//       // Afficher un message de statut approprié
//       const roleText = role === 'etudiant' ? 'Étudiant' : 'Enseignant';
//       const typeText = type === 'entry' ? 'entrée' : 'sortie';
//       let statusMessage = `Initialisation de la reconnaissance pour ${roleText} (${typeText})...`;
      
//       if (courseTitle) {
//           statusMessage += ` - Cours: ${courseTitle}`;
//       }
      
//       updatePresenceStatus('info', statusMessage);

//       // Utiliser la webcam du PC avec des paramètres optimisés
//       streamPresence = await navigator.mediaDevices.getUserMedia({ 
//           video: { 
//               width: { ideal: 1280 },
//               height: { ideal: 720 },
//               facingMode: "user",
//               frameRate: { ideal: 30 }
//           } 
//       });
      
//       if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';
//       const cameraFeedContainer = document.querySelector('.camera-feed');
//       if (cameraFeedContainer) cameraFeedContainer.prepend(video);
//       video.srcObject = streamPresence;

//       // Attendre que la vidéo soit prête
//       await new Promise(resolve => {
//           video.onloadedmetadata = resolve;
//       });

//       video.play();
      
//       updatePresenceStatus('info', `Reconnaissance en cours... Positionnez votre visage dans le cadre`);
//       if (faceOverlay) faceOverlay.classList.add('scanning');
//       cameraActive = true;
      
//       // Mise à jour de l'interface
//       toggleCameraBtn.innerHTML = '<i class="material-icons">videocam_off</i> Arrêter la reconnaissance';
//       toggleCameraBtn.classList.remove('btn-primary');
//       toggleCameraBtn.classList.add('btn-danger');

//       // Démarrer la détection faciale avec gestion des erreurs
//       intervalIdPresence = setInterval(async () => {
//           try {
//               await scanFace(role, type, courseTitle);
//           } catch (error) {
//               console.error('Erreur lors de la détection faciale:', error);
//               // Ne pas arrêter la reconnaissance pour une erreur ponctuelle
//           }
//       }, 2000); // Réduire l'intervalle à 2 secondes

//   } catch (err) {
//       console.error("Erreur d'accès à la caméra: ", err);
//       updatePresenceStatus('error', 'Impossible d\'accéder à la caméra. Vérifiez les permissions.');
      
//       // Réinitialiser l'état en cas d'erreur
//       cameraActive = false;
//       if (toggleCameraBtn) {
//           toggleCameraBtn.innerHTML = '<i class="material-icons">videocam</i> Démarrer la reconnaissance';
//           toggleCameraBtn.classList.remove('btn-danger');
//           toggleCameraBtn.classList.add('btn-primary');
//       }
//   }
// }

// /**
// * Capture une image et l'envoie au serveur de reconnaissance.
// * @param {string} role - Le rôle.
// * @param {string} type - 'entry' ou 'exit'.
// * @param {string|null} courseTitle - Le titre du cours, si applicable.
// */
// async function scanFace(role, type, courseTitle = null) {
//   if (!video.videoWidth || !video.videoHeight) {
//       console.log('Vidéo non prête');
//       return;
//   }
  
//   const canvas = document.createElement('canvas');
//   canvas.width = video.videoWidth;
//   canvas.height = video.videoHeight;
//   const context = canvas.getContext('2d');
//   context.drawImage(video, 0, 0, canvas.width, canvas.height);

//   // Modification ici pour obtenir l'image en base64
//   const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
  
//   const payload = {
//       image: imageDataUrl,
//       role: role,
//       type: type,
//       ...(courseTitle && { course_title: courseTitle })
//   };

//   try {
//       const response = await fetch('http://localhost:5000/reconnaissance', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify(payload)
//       });
      
//       if (!response.ok) {
//           throw new Error(`Erreur HTTP: ${response.status}`);
//       }
      
//       const data = await response.json();
//       updatePresenceStatus(data.status, data.message);
      
      // NE PAS ARRÊTER LA RECONNAISSANCE AUTOMATIQUEMENT
      // La reconnaissance continue jusqu'à ce que l'utilisateur clique sur "Arrêter"
      // if (data.status === 'success' || data.status === 'warning') {
      //     setTimeout(stopFacialRecognition, 3000);
      // }
      
//   } catch (error) {
//       console.error('Erreur de communication avec le serveur Flask :', error);
//       // Ne pas mettre à jour le statut pour éviter de spammer l'utilisateur
//       // La reconnaissance continue malgré les erreurs temporaires
//   }
// }

/**
// * Met à jour le message de statut sur la page de présence.
// * @param {string} status - 'success', 'warning', ou 'error'.
// * @param {string} message - Message à afficher.
// */
// function updatePresenceStatus(status, message) {
//   if (!presenceStatus) return;
//   presenceStatus.textContent = message;
//   presenceStatus.classList.remove('text-success', 'text-warning', 'text-danger', 'text-info');
  
//   if (status === 'success') {
//       presenceStatus.classList.add('text-success');
//   } else if (status === 'warning') {
//       presenceStatus.classList.add('text-warning');
//   } else if (status === 'info') {
//       presenceStatus.classList.add('text-info');
//   } else {
//       presenceStatus.classList.add('text-danger');
//   }
// }





// ============================================================================================================
//                                       ÉCOUTEURS D'ÉVÉNEMENTS AMÉLIORÉS
// ============================================================================================================
// document.addEventListener('DOMContentLoaded', () => {
//   // Écouteur pour le bouton de la page de présence
//   if (toggleCameraBtn) {
//       toggleCameraBtn.addEventListener('click', async () => {
//           if (!cameraActive) {
//               try {
//                   currentRole = document.querySelector('input[name="roleRadio"]:checked').value;
//                   currentType = document.querySelector('input[name="presenceType"]:checked').value;

//                   // Vérifier que les sélections sont valides
//                   if (!currentRole || !currentType) {
//                       updatePresenceStatus('error', 'Veuillez sélectionner un rôle et un type de présence');
//                       return;
//                   }

//                   // Si c'est un enseignant qui fait une entrée, afficher le modal
//                   if (currentRole === 'enseignant' && currentType === 'entry') {
//                       courseModal.style.display = 'flex';
//                       updatePresenceStatus('info', 'Veuillez saisir le titre du cours');
//                   } else {
//                       // Pour les étudiants ou les sorties d'enseignants, démarrer directement
//                       await startFacialRecognition(currentRole, currentType);
//                   }
//               } catch (error) {
//                   console.error('Erreur lors du démarrage de la reconnaissance:', error);
//                   updatePresenceStatus('error', 'Erreur lors du démarrage de la caméra');
//               }
//           } else {
//               stopFacialRecognition();
//           }
//       });
//   }
  
//   // Gestion de la modal du titre du cours
//   if (confirmCourseBtn) {
//       confirmCourseBtn.addEventListener('click', async () => {
//           const courseTitle = courseTitleInput.value.trim();
//           if (courseTitle === '') {
//               updatePresenceStatus('error', 'Veuillez entrer un titre pour votre cours');
//               courseTitleInput.focus();
//               return;
//           }
          
//           courseModal.style.display = 'none';
//           updatePresenceStatus('info', `Enregistrement pour le cours: ${courseTitle}`);
          
//           // Démarrer la reconnaissance après un court délai pour permettre la fermeture du modal
//           setTimeout(async () => {
//               await startFacialRecognition(currentRole, currentType, courseTitle);
//           }, 100);
//       });
//   }

//   if (cancelCourseBtn) {
//       cancelCourseBtn.addEventListener('click', () => {
//           courseModal.style.display = 'none';
//           courseTitleInput.value = '';
//           updatePresenceStatus('info', 'Opération annulée');
//       });
//   }
  
//   // Réinitialiser le formulaire quand on change le type de présence
//   presenceTypeRadios.forEach(radio => {
//       radio.addEventListener('change', () => {
//           if (courseTitleInput) {
//               courseTitleInput.value = '';
//           }
//           // Mettre à jour le statut pour refléter le changement
//           const type = radio.value;
//           updatePresenceStatus('info', `Mode ${type === 'entry' ? 'entrée' : 'sortie'} sélectionné`);
//       });
//   });

//   // Ajouter des écouteurs pour les changements de rôle
//   roleRadios.forEach(radio => {
//       radio.addEventListener('change', () => {
//           const role = radio.value;
//           updatePresenceStatus('info', `Rôle ${role === 'etudiant' ? 'étudiant' : 'enseignant'} sélectionné`);
//       });
//   });

//   // Fermer le modal si on clique en dehors
//   if (courseModal) {
//       courseModal.addEventListener('click', (e) => {
//           if (e.target === courseModal) {
//               courseModal.style.display = 'none';
//               courseTitleInput.value = '';
//           }
//       });
//   }

//   // Permettre la soumission du formulaire avec la touche Entrée
//   if (courseTitleInput) {
//       courseTitleInput.addEventListener('keypress', (e) => {
//           if (e.key === 'Enter') {
//               confirmCourseBtn.click();
//           }
//       });
//   }
// });

// // Amélioration de la fonction startFacialRecognition
// async function startFacialRecognition(role, type, courseTitle = null) {
//   if (streamPresence) {
//       return;
//   }

//   try {
//       // Afficher un message de statut approprié
//       const roleText = role === 'etudiant' ? 'Étudiant' : 'Enseignant';
//       const typeText = type === 'entry' ? 'entrée' : 'sortie';
//       let statusMessage = `Initialisation de la reconnaissance pour ${roleText} (${typeText})...`;
      
//       if (courseTitle) {
//           statusMessage += ` - Cours: ${courseTitle}`;
//       }
      
//       updatePresenceStatus('info', statusMessage);

//       // Utiliser la webcam du PC avec des paramètres optimisés
//       streamPresence = await navigator.mediaDevices.getUserMedia({ 
//           video: { 
//               width: { ideal: 1280 },
//               height: { ideal: 720 },
//               facingMode: "user",
//               frameRate: { ideal: 30 }
//           } 
//       });
      
//       if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';
//       const cameraFeedContainer = document.querySelector('.camera-feed');
//       if (cameraFeedContainer) cameraFeedContainer.prepend(video);
//       video.srcObject = streamPresence;

//       // Attendre que la vidéo soit prête
//       await new Promise(resolve => {
//           video.onloadedmetadata = resolve;
//       });

//       video.play();
      
//       updatePresenceStatus('info', `Reconnaissance en cours... Suivez les instructions`);
//       if (faceOverlay) faceOverlay.classList.add('scanning');
//       cameraActive = true;
      
//       // Mise à jour de l'interface
//       toggleCameraBtn.innerHTML = '<i class="material-icons">videocam_off</i> Arrêter la reconnaissance';
//       toggleCameraBtn.classList.remove('btn-primary');
//       toggleCameraBtn.classList.add('btn-danger');

//       // Démarrer la détection faciale
//       intervalIdPresence = setInterval(() => scanFace(role, type, courseTitle), 1500);

//   } catch (err) {
//       console.error("Erreur d'accès à la caméra: ", err);
//       updatePresenceStatus('error', 'Impossible d\'accéder à la caméra. Vérifiez les permissions.');
      
//       // Réinitialiser l'état en cas d'erreur
//       cameraActive = false;
//       if (toggleCameraBtn) {
//           toggleCameraBtn.innerHTML = '<i class="material-icons">videocam</i> Démarrer la reconnaissance';
//           toggleCameraBtn.classList.remove('btn-danger');
//           toggleCameraBtn.classList.add('btn-primary');
//       }
//   }
// }




// // ============================================================================================================
// //                                       ÉCOUTEURS D'ÉVÉNEMENTS
// // ============================================================================================================
// document.addEventListener('DOMContentLoaded', () => {
//     // Écouteur pour le bouton de la page de présence
//     if (toggleCameraBtn) {
//         toggleCameraBtn.addEventListener('click', () => {
//             if (!cameraActive) {
//                 currentRole = document.querySelector('input[name="roleRadio"]:checked').value;
//                 currentType = document.querySelector('input[name="presenceType"]:checked').value;

//                 // Si c'est un enseignant qui fait une entrée, afficher le modal
//                 if (currentRole === 'enseignant' && currentType === 'entry') {
//                     courseModal.style.display = 'flex';
//                 } else {
//                     // Pour les étudiants ou les sorties d'enseignants, démarrer directement
//                     startFacialRecognition(currentRole, currentType);
//                 }
//             } else {
//                 stopFacialRecognition();
//             }
//         });
//     }
    
//     // Gestion de la modal du titre du cours
//     if (confirmCourseBtn) {
//         confirmCourseBtn.addEventListener('click', () => {
//             const courseTitle = courseTitleInput.value;
//             if (courseTitle.trim() === '') {
//                 alert('Veuillez entrer un titre pour votre cours');
//                 return;
//             }
//             courseModal.style.display = 'none';
//             startFacialRecognition(currentRole, currentType, courseTitle);
//             updatePresenceStatus('info', `Démarrage de la reconnaissance pour l'enseignant - Cours: ${courseTitle}`);
//         });
//     }

//     if (cancelCourseBtn) {
//         cancelCourseBtn.addEventListener('click', () => {
//             courseModal.style.display = 'none';
//             courseTitleInput.value = '';
//         });
//     }
    
//     // Réinitialiser le formulaire quand on change le type de présence
//     presenceTypeRadios.forEach(radio => {
//         radio.addEventListener('change', () => {
//             if (courseTitleInput) {
//                 courseTitleInput.value = '';
//             }
//         });
//     });
// });







// // ------------------------------
// // Gestion de la page Présences et de la reconnaissance faciale
// // ------------------------------

// // Sélection des éléments DOM
// const roleBtns = document.querySelectorAll('.role-btn');
// const entryBtn = document.getElementById('entry-btn');
// const exitBtn = document.getElementById('exit-btn');
// const cameraPlaceholder = document.querySelector('.camera-placeholder');
// const video = document.createElement('video');
// video.autoplay = true;
// video.playsinline = true;
// video.classList.add('w-100', 'rounded', 'border');
// const presenceStatus = document.getElementById('presence-status');
// const faceOverlay = document.querySelector('.face-overlay');
// let stream = null;
// let intervalId = null;

// // Gestion de la sélection du rôle
// roleBtns.forEach(btn => {
//   btn.addEventListener('click', () => {
//     roleBtns.forEach(b => b.classList.remove('active'));
//     btn.classList.add('active');
//     const role = btn.getAttribute('data-role');
//     presenceStatus.textContent = `Statut sélectionné: ${role === 'etudiant' ? 'Étudiant' : 'Enseignant'}`;
//     stopFacialRecognition();
//   });
// });

// /**
//  * Fonction pour démarrer la reconnaissance faciale pour un type de présence (entrée ou sortie).
//  * @param {string} type - Le type d'action ("entrer" ou "sortir").
//  */
// async function startFacialRecognition(type) {
//     if (stream) {
//         // Si le scan est déjà en cours, on l'arrête
//         stopFacialRecognition();
//         return;
//     }

//     try {
//         // Utilisation de la webcam par défaut de l'utilisateur
//         stream = await navigator.mediaDevices.getUserMedia({ 
//             video: { 
//                 width: { ideal: 1280 },
//                 height: { ideal: 720 },
//                 facingMode: "user" 
//             }
//         });
        
//         // Remplacer l'icône de la caméra par le flux vidéo
//         cameraPlaceholder.style.display = 'none';
//         const cameraFeedContainer = document.querySelector('.camera-feed');
//         cameraFeedContainer.prepend(video);
//         video.srcObject = stream;
        
//         // Mettre à jour l'état de l'interface
//         const role = document.querySelector('.role-btn.active').getAttribute('data-role');
//         const message = type === 'entrer' ?
//             `Démarrage de la reconnaissance faciale pour l'entrée en tant que ${role}...` :
//             `Démarrage de la reconnaissance faciale pour la sortie en tant que ${role}...`;
//         presenceStatus.textContent = message;
//         presenceStatus.classList.remove('text-red-400', 'text-yellow-400');
//         faceOverlay.classList.add('scanning');

//         // Lancer la détection faciale de manière répétée
//         intervalId = setInterval(() => scanFace(type), 1500);

//     } catch (err) {
//         console.error("Erreur d'accès à la caméra :", err);
//         presenceStatus.textContent = "Accès à la caméra refusé. Vérifiez les permissions du navigateur.";
//         presenceStatus.classList.add('text-danger');
//         presenceStatus.classList.remove('text-success', 'text-warning');
//         stopFacialRecognition();
//     }
// }

// /**
//  * Fonction pour arrêter le flux vidéo et la détection faciale.
//  */
// function stopFacialRecognition() {
//     if (stream) {
//         stream.getTracks().forEach(track => track.stop());
//         stream = null;
//         clearInterval(intervalId);
//         video.srcObject = null;
//         video.remove();
//         cameraPlaceholder.style.display = 'flex';
//     }
//     faceOverlay.classList.remove('scanning');
//     entryBtn.disabled = false;
//     exitBtn.disabled = false;
// }

// /**
//  * Capture une image et l'envoie au serveur pour traitement.
//  * @param {string} type - 'entrer' ou 'sortir'.
//  */
// async function scanFace(type) {
//     const canvas = document.createElement('canvas');
//     canvas.width = video.videoWidth;
//     canvas.height = video.videoHeight;
//     const ctx = canvas.getContext('2d');
//     ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
//     const imageData = canvas.toDataURL('image/jpeg', 0.8);

//     try {
//         const response = await fetch('http://localhost:5000/predict', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ image: imageData, action: type })
//         });

//         if (!response.ok) {
//             throw new Error(`Erreur réseau : ${response.status} ${response.statusText}`);
//         }

//         const result = await response.json();
        
//         // Mettre à jour le message de statut
//         updateStatusMessage(result.status, result.message);

//     } catch (error) {
//         console.error('Erreur de communication avec le serveur Flask :', error);
//         updateStatusMessage('error', 'Erreur : Serveur de reconnaissance non disponible.');
//     }
// }

// /**
//  * Met à jour le message de statut et les classes CSS correspondantes.
//  * @param {string} status - 'success', 'warning', ou 'error'.
//  * @param {string} message - Le message à afficher.
//  */
// function updateStatusMessage(status, message) {
//     presenceStatus.textContent = message;
//     presenceStatus.classList.remove('text-success', 'text-warning', 'text-danger');
    
//     if (status === 'success') {
//         presenceStatus.classList.add('text-success');
//         // Optionnel : Arrêter le scan après une reconnaissance réussie
//         // setTimeout(stopFacialRecognition, 3000); 
//     } else if (status === 'warning') {
//         presenceStatus.classList.add('text-warning');
//     } else {
//         presenceStatus.classList.add('text-danger');
//     }
// }

// // Écouteurs d'événements pour les boutons d'entrée et de sortie
// entryBtn.addEventListener('click', () => startFacialRecognition('entrer'));
// exitBtn.addEventListener('click', () => startFacialRecognition('sortir'));

// // ------------------------------
// // Gestion de la Foire Aux Questions (FAQ)
// // ------------------------------
// document.addEventListener('DOMContentLoaded', () => {
//   // Sélectionnez tous les boutons qui déclenchent les questions
//   const faqQuestions = document.querySelectorAll('.accordion-button');

//   faqQuestions.forEach(question => {
//       question.addEventListener('click', () => {
//           // L'effet d'accordéon est géré par Bootstrap, le code JS n'est plus nécessaire ici.
//           // On peut l'utiliser pour d'autres fonctionnalités si besoin.
//       });
//   });
// });


// // ============================================================================================================
// //                                     VARIABLES GLOBALES POUR LA RECONNAISSANCE
// // ============================================================================================================
// const toggleCameraBtn = document.getElementById('toggle-camera-btn');
// const roleRadios = document.querySelectorAll('input[name="roleRadio"]');
// const presenceTypeRadios = document.querySelectorAll('input[name="presenceType"]');
// const presenceStatus = document.getElementById('presence-status');
// const faceOverlay = document.querySelector('.face-overlay');
// const cameraPlaceholder = document.querySelector('.camera-placeholder');
// const video = document.createElement('video');
// video.autoplay = true;
// video.playsinline = true;
// video.classList.add('w-100', 'rounded', 'border');
// const courseModal = document.getElementById('course-modal');
// const courseTitleInput = document.getElementById('course-title');
// const confirmCourseBtn = document.getElementById('confirm-course');
// const cancelCourseBtn = document.getElementById('cancel-course');

// // Variables pour la reconnaissance faciale
// let streamPresence = null;
// let intervalIdPresence = null;
// let cameraActive = false;
// let recognizedPerson = null;
// let currentRole = null;
// let currentType = null;
// let courseTitle = null;

// // ============================================================================================================
// //                                     FONCTIONS DE RECONNAISSANCE FACIALE
// // ============================================================================================================

// /**
//  * Capture une image et utilise le modèle CNN pour la reconnaissance
//  */
// async function scanFaceWithCNN() {
//     if (!video.videoWidth || !video.videoHeight) {
//         console.log('Vidéo non prête');
//         return null;
//     }
    
//     const canvas = document.createElement('canvas');
//     canvas.width = video.videoWidth;
//     canvas.height = video.videoHeight;
//     const context = canvas.getContext('2d');
//     context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
//     // Envoyer l'image au serveur pour reconnaissance CNN
//     try {
//         const response = await fetch('http://localhost:5000/reconnaissance_cnn', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ image: canvas.toDataURL('image/jpeg', 0.8) })
//         });
        
//         if (!response.ok) {
//             throw new Error(`Erreur HTTP: ${response.status}`);
//         }
        
//         const data = await response.json();
//         return data;
        
//     } catch (error) {
//         console.error('Erreur de communication avec le serveur :', error);
//         return { status: 'error', message: 'Erreur de communication' };
//     }
// }

// /**
//  * Enregistre la présence après reconnaissance
//  */
// async function enregistrerPresence() {
//     if (!recognizedPerson) {
//         updatePresenceStatus('error', 'Aucune personne reconnue à enregistrer');
//         return false;
//     }
    
//     try {
//         const response = await fetch('http://localhost:5000/enregistrer_presence', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 nom: recognizedPerson.name,
//                 role: recognizedPerson.role,
//                 type: currentType,
//                 cours: courseTitle,
//                 confidence: recognizedPerson.confidence
//             })
//         });
        
//         const result = await response.json();
//         updatePresenceStatus(result.status, result.message);
//         return result.status === 'success';
        
//     } catch (error) {
//         console.error('Erreur lors de l\'enregistrement:', error);
//         updatePresenceStatus('error', 'Erreur lors de l\'enregistrement');
//         return false;
//     }
// }

// /**
//  * Démarre la reconnaissance faciale avec CNN
//  */
// async function startFacialRecognition(role, type, cours = null) {
//     if (streamPresence) {
//         return;
//     }

//     try {
//         // Réinitialiser les variables
//         recognizedPerson = null;
//         currentRole = role;
//         currentType = type;
//         courseTitle = cours;

//         // Utiliser la webcam du PC
//         streamPresence = await navigator.mediaDevices.getUserMedia({ 
//             video: { 
//                 width: { ideal: 1280 },
//                 height: { ideal: 720 },
//                 facingMode: "user",
//                 frameRate: { ideal: 30 }
//             } 
//         });
        
//         if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';
//         const cameraFeedContainer = document.querySelector('.camera-feed');
//         if (cameraFeedContainer) cameraFeedContainer.prepend(video);
//         video.srcObject = streamPresence;

//         // Attendre que la vidéo soit prête
//         await new Promise(resolve => {
//             video.onloadedmetadata = resolve;
//         });

//         video.play();
        
//         // Mise à jour de l'interface
//         const roleText = role === 'etudiant' ? 'Étudiant' : 'Enseignant';
//         const typeText = type === 'entry' ? 'entrée' : 'sortie';
//         let statusMessage = `Reconnaissance pour ${roleText} (${typeText}) en cours...`;
        
//         if (cours) {
//             statusMessage += ` - Cours: ${cours}`;
//         }
        
//         updatePresenceStatus('info', statusMessage);
//         if (faceOverlay) faceOverlay.classList.add('scanning');
//         cameraActive = true;
        
//         toggleCameraBtn.innerHTML = '<i class="material-icons">videocam_off</i> Arrêter la reconnaissance';
//         toggleCameraBtn.classList.remove('btn-primary');
//         toggleCameraBtn.classList.add('btn-danger');

//         // Démarrer la détection faciale
//         intervalIdPresence = setInterval(async () => {
//             try {
//                 const result = await scanFaceWithCNN();
//                 if (result && result.status === 'success') {
//                     recognizedPerson = {
//                         name: result.name,
//                         role: result.role,
//                         confidence: result.confidence
//                     };
                    
//                     updatePresenceStatus('info', 
//                         `${result.name} détecté - Confiance: ${(result.confidence * 100).toFixed(1)}%`);
                    
//                 } else if (result && result.status === 'warning') {
//                     updatePresenceStatus('warning', result.message);
//                 }
//             } catch (error) {
//                 console.error('Erreur lors de la détection faciale:', error);
//             }
//         }, 2000);

//     } catch (err) {
//         console.error("Erreur d'accès à la caméra: ", err);
//         updatePresenceStatus('error', 'Impossible d\'accéder à la caméra. Vérifiez les permissions.');
        
//         // Réinitialiser l'état en cas d'erreur
//         cameraActive = false;
//         if (toggleCameraBtn) {
//             toggleCameraBtn.innerHTML = '<i class="material-icons">videocam</i> Démarrer la reconnaissance';
//             toggleCameraBtn.classList.remove('btn-danger');
//             toggleCameraBtn.classList.add('btn-primary');
//         }
//     }
// }

// /**
//  * Arrête la reconnaissance faciale et enregistre la présence
//  */
// async function stopFacialRecognitionAndSave() {
//     // Arrêter le flux vidéo
//     if (streamPresence) {
//         streamPresence.getTracks().forEach(track => track.stop());
//         streamPresence = null;
//         clearInterval(intervalIdPresence);
//         video.srcObject = null;
//         if (video.parentNode) video.parentNode.removeChild(video);
//         if (cameraPlaceholder) cameraPlaceholder.style.display = 'flex';
//     }
    
//     if (faceOverlay) faceOverlay.classList.remove('scanning');
//     cameraActive = false;
    
//     // Mise à jour de l'interface
//     if (toggleCameraBtn) {
//         toggleCameraBtn.innerHTML = '<i class="material-icons">videocam</i> Démarrer la reconnaissance';
//         toggleCameraBtn.classList.remove('btn-danger');
//         toggleCameraBtn.classList.add('btn-primary');
//     }
    
//     // Enregistrer la présence si une personne a été reconnue
//     if (recognizedPerson) {
//         updatePresenceStatus('info', 'Enregistrement de la présence...');
//         const success = await enregistrerPresence();
        
//         if (success) {
//             // Réinitialiser après enregistrement réussi
//             recognizedPerson = null;
//         }
//     } else {
//         updatePresenceStatus('warning', 'Arrêté. Aucune présence enregistrée (personne non reconnue).');
//     }
// }

// /**
//  * Met à jour le message de statut sur la page de présence.
//  * @param {string} status - 'success', 'warning', ou 'error'.
//  * @param {string} message - Message à afficher.
//  */
// function updatePresenceStatus(status, message) {
//     if (!presenceStatus) return;
//     presenceStatus.textContent = message;
//     presenceStatus.classList.remove('text-success', 'text-warning', 'text-danger', 'text-info');
    
//     if (status === 'success') {
//         presenceStatus.classList.add('text-success');
//     } else if (status === 'warning') {
//         presenceStatus.classList.add('text-warning');
//     } else if (status === 'info') {
//         presenceStatus.classList.add('text-info');
//     } else {
//         presenceStatus.classList.add('text-danger');
//     }
// }

// // ============================================================================================================
// //                                       ÉCOUTEURS D'ÉVÉNEMENTS
// // ============================================================================================================
// document.addEventListener('DOMContentLoaded', () => {
//     // Écouteur pour le bouton de la page de présence
//     if (toggleCameraBtn) {
//         toggleCameraBtn.addEventListener('click', async () => {
//             if (!cameraActive) {
//                 // Démarrer la reconnaissance
//                 const role = document.querySelector('input[name="roleRadio"]:checked').value;
//                 const type = document.querySelector('input[name="presenceType"]:checked').value;

//                 // Vérifier que les sélections sont valides
//                 if (!role || !type) {
//                     updatePresenceStatus('error', 'Veuillez sélectionner un rôle et un type de présence');
//                     return;
//                 }

//                 // Si c'est un enseignant qui fait une entrée, afficher le modal
//                 if (role === 'enseignant' && type === 'entry') {
//                     courseModal.style.display = 'flex';
//                     updatePresenceStatus('info', 'Veuillez saisir le titre du cours');
//                 } else {
//                     // Pour les étudiants ou les sorties d'enseignants, démarrer directement
//                     await startFacialRecognition(role, type);
//                 }
//             } else {
//                 // Arrêter la reconnaissance et enregistrer
//                 await stopFacialRecognitionAndSave();
//             }
//         });
//     }
    
//     // Gestion de la modal du titre du cours
//     if (confirmCourseBtn) {
//         confirmCourseBtn.addEventListener('click', async () => {
//             const title = courseTitleInput.value.trim();
//             if (title === '') {
//                 updatePresenceStatus('error', 'Veuillez entrer un titre pour votre cours');
//                 courseTitleInput.focus();
//                 return;
//             }
            
//             courseModal.style.display = 'none';
//             courseTitle = title;
            
//             // Démarrer la reconnaissance après la fermeture du modal
//             const role = document.querySelector('input[name="roleRadio"]:checked').value;
//             const type = document.querySelector('input[name="presenceType"]:checked').value;
            
//             await startFacialRecognition(role, type, title);
//         });
//     }

//     if (cancelCourseBtn) {
//         cancelCourseBtn.addEventListener('click', () => {
//             courseModal.style.display = 'none';
//             courseTitleInput.value = '';
//             updatePresenceStatus('info', 'Opération annulée');
//         });
//     }
    
//     // Fermer le modal si on clique en dehors
//     if (courseModal) {
//         courseModal.addEventListener('click', (e) => {
//             if (e.target === courseModal) {
//                 courseModal.style.display = 'none';
//                 courseTitleInput.value = '';
//             }
//         });
//     }
// });



// // ============================================================================================================
// //                                     VARIABLES GLOBALES POUR LA RECONNAISSANCE
// // ============================================================================================================
// const toggleCameraBtn = document.getElementById('toggle-camera-btn');
// const roleRadios = document.querySelectorAll('input[name="roleRadio"]');
// const presenceTypeRadios = document.querySelectorAll('input[name="presenceType"]');
// const presenceStatus = document.getElementById('presence-status');
// const faceOverlay = document.querySelector('.face-overlay');
// const cameraPlaceholder = document.querySelector('.camera-placeholder');
// const video = document.createElement('video');
// video.autoplay = true;
// video.playsinline = true;
// video.classList.add('w-100', 'rounded', 'border');
// const courseModal = document.getElementById('course-modal');
// const courseTitleInput = document.getElementById('course-title');
// const confirmCourseBtn = document.getElementById('confirm-course');
// const cancelCourseBtn = document.getElementById('cancel-course');

// // Variables pour la reconnaissance faciale
// let streamPresence = null;
// let intervalIdPresence = null;
// let cameraActive = false;
// let recognizedPerson = null;
// let currentRole = null;
// let currentType = null;
// let courseTitle = null;

// // ============================================================================================================
// //                                     FONCTIONS DE RECONNAISSANCE FACIALE
// // ============================================================================================================

// /**
//  * Capture une image et utilise le modèle CNN pour la reconnaissance
//  */
// async function scanFaceWithCNN() {
//     if (!video.videoWidth || !video.videoHeight) {
//         console.log('Vidéo non prête');
//         return null;
//     }
    
//     const canvas = document.createElement('canvas');
//     canvas.width = video.videoWidth;
//     canvas.height = video.videoHeight;
//     const context = canvas.getContext('2d');
//     context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
//     // Envoyer l'image au serveur pour reconnaissance CNN
//     try {
//         const response = await fetch('http://localhost:5000/reconnaissance_cnn', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ image: canvas.toDataURL('image/jpeg', 0.8) })
//         });
        
//         if (!response.ok) {
//             throw new Error(`Erreur HTTP: ${response.status}`);
//         }
        
//         const data = await response.json();
//         return data;
        
//     } catch (error) {
//         console.error('Erreur de communication avec le serveur :', error);
//         return { status: 'error', message: 'Erreur de communication' };
//     }
// }

// /**
//  * Enregistre la présence après reconnaissance
//  */
// async function enregistrerPresence() {
//     if (!recognizedPerson) {
//         updatePresenceStatus('error', 'Aucune personne reconnue à enregistrer');
//         return false;
//     }
    
//     try {
//         const response = await fetch('http://localhost:5000/enregistrer_presence', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 nom: recognizedPerson.name,
//                 role: recognizedPerson.role,
//                 type: currentType,
//                 cours: courseTitle,
//                 confidence: recognizedPerson.confidence
//             })
//         });
        
//         const result = await response.json();
//         updatePresenceStatus(result.status, result.message);
//         return result.status === 'success';
        
//     } catch (error) {
//         console.error('Erreur lors de l\'enregistrement:', error);
//         updatePresenceStatus('error', 'Erreur lors de l\'enregistrement');
//         return false;
//     }
// }

// /**
//  * Démarre la reconnaissance faciale avec CNN
//  */
// async function startFacialRecognition(role, type, cours = null) {
//     if (streamPresence) {
//         return;
//     }

//     try {
//         // Réinitialiser les variables
//         recognizedPerson = null;
//         currentRole = role;
//         currentType = type;
//         courseTitle = cours;

//         // Utiliser la webcam du PC
//         streamPresence = await navigator.mediaDevices.getUserMedia({ 
//             video: { 
//                 width: { ideal: 1280 },
//                 height: { ideal: 720 },
//                 facingMode: "user",
//                 frameRate: { ideal: 30 }
//             } 
//         });
        
//         if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';
//         const cameraFeedContainer = document.querySelector('.camera-feed');
//         if (cameraFeedContainer) cameraFeedContainer.prepend(video);
//         video.srcObject = streamPresence;

//         // Attendre que la vidéo soit prête
//         await new Promise(resolve => {
//             video.onloadedmetadata = resolve;
//         });

//         video.play();
        
//         // Mise à jour de l'interface
//         const roleText = role === 'etudiant' ? 'Étudiant' : 'Enseignant';
//         const typeText = type === 'entry' ? 'entrée' : 'sortie';
//         let statusMessage = `Reconnaissance pour ${roleText} (${typeText}) en cours...`;
        
//         if (cours) {
//             statusMessage += ` - Cours: ${cours}`;
//         }
        
//         updatePresenceStatus('info', statusMessage);
//         if (faceOverlay) faceOverlay.classList.add('scanning');
//         cameraActive = true;
        
//         toggleCameraBtn.innerHTML = '<i class="material-icons">videocam_off</i> Arrêter la reconnaissance';
//         toggleCameraBtn.classList.remove('btn-primary');
//         toggleCameraBtn.classList.add('btn-danger');

//         // Démarrer la détection faciale
//         intervalIdPresence = setInterval(async () => {
//             try {
//                 const result = await scanFaceWithCNN();
//                 if (result && result.status === 'success') {
//                     recognizedPerson = {
//                         name: result.name,
//                         role: result.role,
//                         confidence: result.confidence
//                     };
                    
//                     updatePresenceStatus('info', 
//                         `${result.name} détecté - Confiance: ${(result.confidence * 100).toFixed(1)}%`);
                    
//                 } else if (result && result.status === 'warning') {
//                     updatePresenceStatus('warning', result.message);
//                 }
//             } catch (error) {
//                 console.error('Erreur lors de la détection faciale:', error);
//             }
//         }, 2000);

//     } catch (err) {
//         console.error("Erreur d'accès à la caméra: ", err);
//         updatePresenceStatus('error', 'Impossible d\'accéder à la caméra. Vérifiez les permissions.');
        
//         // Réinitialiser l'état en cas d'erreur
//         cameraActive = false;
//         if (toggleCameraBtn) {
//             toggleCameraBtn.innerHTML = '<i class="material-icons">videocam</i> Démarrer la reconnaissance';
//             toggleCameraBtn.classList.remove('btn-danger');
//             toggleCameraBtn.classList.add('btn-primary');
//         }
//     }
// }

// /**
//  * Arrête la reconnaissance faciale et enregistre la présence
//  */
// async function stopFacialRecognitionAndSave() {
//     // Arrêter le flux vidéo
//     if (streamPresence) {
//         streamPresence.getTracks().forEach(track => track.stop());
//         streamPresence = null;
//         clearInterval(intervalIdPresence);
//         video.srcObject = null;
//         if (video.parentNode) video.parentNode.removeChild(video);
//         if (cameraPlaceholder) cameraPlaceholder.style.display = 'flex';
//     }
    
//     if (faceOverlay) faceOverlay.classList.remove('scanning');
//     cameraActive = false;
    
//     // Mise à jour de l'interface
//     if (toggleCameraBtn) {
//         toggleCameraBtn.innerHTML = '<i class="material-icons">videocam</i> Démarrer la reconnaissance';
//         toggleCameraBtn.classList.remove('btn-danger');
//         toggleCameraBtn.classList.add('btn-primary');
//     }
    
//     // Enregistrer la présence si une personne a été reconnue
//     if (recognizedPerson) {
//         updatePresenceStatus('info', 'Enregistrement de la présence...');
//         const success = await enregistrerPresence();
        
//         if (success) {
//             // Réinitialiser après enregistrement réussi
//             recognizedPerson = null;
//         }
//     } else {
//         updatePresenceStatus('warning', 'Arrêté. Aucune présence enregistrée (personne non reconnue).');
//     }
// }

// /**
//  * Met à jour le message de statut sur la page de présence.
//  * @param {string} status - 'success', 'warning', ou 'error'.
//  * @param {string} message - Message à afficher.
//  */
// function updatePresenceStatus(status, message) {
//     if (!presenceStatus) return;
//     presenceStatus.textContent = message;
//     presenceStatus.classList.remove('text-success', 'text-warning', 'text-danger', 'text-info');
    
//     if (status === 'success') {
//         presenceStatus.classList.add('text-success');
//     } else if (status === 'warning') {
//         presenceStatus.classList.add('text-warning');
//     } else if (status === 'info') {
//         presenceStatus.classList.add('text-info');
//     } else {
//         presenceStatus.classList.add('text-danger');
//     }
// }

// // ============================================================================================================
// //                                       ÉCOUTEURS D'ÉVÉNEMENTS
// // ============================================================================================================
// document.addEventListener('DOMContentLoaded', () => {
//     // Écouteur pour le bouton de la page de présence
//     if (toggleCameraBtn) {
//         toggleCameraBtn.addEventListener('click', async () => {
//             if (!cameraActive) {
//                 // Démarrer la reconnaissance
//                 const role = document.querySelector('input[name="roleRadio"]:checked').value;
//                 const type = document.querySelector('input[name="presenceType"]:checked').value;

//                 // Vérifier que les sélections sont valides
//                 if (!role || !type) {
//                     updatePresenceStatus('error', 'Veuillez sélectionner un rôle et un type de présence');
//                     return;
//                 }

//                 // Si c'est un enseignant qui fait une entrée, afficher le modal
//                 if (role === 'enseignant' && type === 'entry') {
//                     courseModal.style.display = 'flex';
//                     updatePresenceStatus('info', 'Veuillez saisir le titre du cours');
//                 } else {
//                     // Pour les étudiants ou les sorties d'enseignants, démarrer directement
//                     await startFacialRecognition(role, type);
//                 }
//             } else {
//                 // Arrêter la reconnaissance et enregistrer
//                 await stopFacialRecognitionAndSave();
//             }
//         });
//     }
    
//     // Gestion de la modal du titre du cours
//     if (confirmCourseBtn) {
//         confirmCourseBtn.addEventListener('click', async () => {
//             const title = courseTitleInput.value.trim();
//             if (title === '') {
//                 updatePresenceStatus('error', 'Veuillez entrer un titre pour votre cours');
//                 courseTitleInput.focus();
//                 return;
//             }
            
//             courseModal.style.display = 'none';
//             courseTitle = title;
            
//             // Démarrer la reconnaissance après la fermeture du modal
//             const role = document.querySelector('input[name="roleRadio"]:checked').value;
//             const type = document.querySelector('input[name="presenceType"]:checked').value;
            
//             await startFacialRecognition(role, type, title);
//         });
//     }

//     if (cancelCourseBtn) {
//         cancelCourseBtn.addEventListener('click', () => {
//             courseModal.style.display = 'none';
//             courseTitleInput.value = '';
//             updatePresenceStatus('info', 'Opération annulée');
//         });
//     }
    
//     // Fermer le modal si on clique en dehors
//     if (courseModal) {
//         courseModal.addEventListener('click', (e) => {
//             if (e.target === courseModal) {
//                 courseModal.style.display = 'none';
//                 courseTitleInput.value = '';
//             }
//         });
//     }
// });

// ============================================================================================================
//                                     VARIABLES GLOBALES POUR LA RECONNAISSANCE
// ============================================================================================================
const toggleCameraBtn = document.getElementById('toggle-camera-btn');
const roleRadios = document.querySelectorAll('input[name="roleRadio"]');
const presenceTypeRadios = document.querySelectorAll('input[name="presenceType"]');
const presenceStatus = document.getElementById('presence-status');
const faceOverlay = document.querySelector('.face-overlay');
const cameraPlaceholder = document.querySelector('.camera-placeholder');
const video = document.createElement('video');
video.autoplay = true;
video.playsinline = true;
video.classList.add('w-100', 'rounded', 'border');
const courseModal = document.getElementById('course-modal');
const courseTitleInput = document.getElementById('course-title');
const confirmCourseBtn = document.getElementById('confirm-course');
const cancelCourseBtn = document.getElementById('cancel-course');

// Variables pour la reconnaissance faciale
let streamPresence = null;
let intervalIdPresence = null;
let cameraActive = false;
let recognizedPerson = null;
let currentRole = null;
let currentType = null;
let courseTitle = null;
let recognitionAttempts = 0;
const MAX_ATTEMPTS = 10;

// ============================================================================================================
//                                     FONCTIONS DE RECONNAISSANCE AMÉLIORÉES
// ============================================================================================================

/**
 * Capture une image et utilise la reconnaissance hybride
 */
async function scanFaceHybrid() {
    if (!video.videoWidth || !video.videoHeight) {
        return null;
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    try {
        const response = await fetch('http://localhost:5000/reconnaissance_hybride', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                image: canvas.toDataURL('image/jpeg', 0.8)
            })
        });
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('Erreur de communication avec le serveur :', error);
        return { status: 'error', message: 'Erreur de communication avec le serveur' };
    }
}

/**
 * Enregistre la présence après reconnaissance
 */
async function enregistrerPresence() {
    if (!recognizedPerson) {
        updatePresenceStatus('error', 'Aucune personne reconnue à enregistrer');
        return false;
    }
    
    try {
        const response = await fetch('http://localhost:5000/enregistrer_presence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nom: recognizedPerson.name,
                role: recognizedPerson.role,
                type: currentType,
                cours: courseTitle,
                confidence: recognizedPerson.confidence
            })
        });
        
        const result = await response.json();
        updatePresenceStatus(result.status, result.message);
        return result.status === 'success';
        
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement:', error);
        updatePresenceStatus('error', 'Erreur lors de l\'enregistrement dans la base de données');
        return false;
    }
}

/**
 * Démarre la reconnaissance faciale hybride
 */
async function startFacialRecognition(role, type, cours = null) {
    if (streamPresence) {
        return;
    }

    try {
        // Réinitialiser les variables
        recognizedPerson = null;
        currentRole = role;
        currentType = type;
        courseTitle = cours;
        recognitionAttempts = 0;

        // Vérifier que le serveur est accessible
        try {
            const healthCheck = await fetch('http://localhost:5000/health');
            if (!healthCheck.ok) {
                throw new Error('Serveur non disponible');
            }
        } catch (error) {
            updatePresenceStatus('error', 'Serveur de reconnaissance non disponible. Démarrez le serveur Flask.');
            return;
        }

        // Utiliser la webcam du PC
        streamPresence = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user",
                frameRate: { ideal: 30 }
            } 
        });
        
        if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';
        const cameraFeedContainer = document.querySelector('.camera-feed');
        if (cameraFeedContainer) {
            cameraFeedContainer.prepend(video);
            video.srcObject = streamPresence;
        }

        // Attendre que la vidéo soit prête
        await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = reject;
            setTimeout(() => reject(new Error('Timeout chargement vidéo')), 5000);
        });

        video.play();
        
        // Mise à jour de l'interface
        const roleText = role === 'etudiant' ? 'Étudiant' : 'Enseignant';
        const typeText = type === 'entry' ? 'entrée' : 'sortie';
        let statusMessage = `Reconnaissance pour ${roleText} (${typeText}) en cours...`;
        
        if (cours) {
            statusMessage += ` - Cours: ${cours}`;
        }
        
        updatePresenceStatus('info', statusMessage);
        if (faceOverlay) faceOverlay.classList.add('scanning');
        cameraActive = true;
        
        toggleCameraBtn.innerHTML = '<i class="material-icons">videocam_off</i> Arrêter la reconnaissance';
        toggleCameraBtn.classList.remove('btn-primary');
        toggleCameraBtn.classList.add('btn-danger');

        // Démarrer la détection faciale avec intervalle
        intervalIdPresence = setInterval(async () => {
            if (recognitionAttempts >= MAX_ATTEMPTS) {
                updatePresenceStatus('warning', 'Nombre maximum de tentatives atteint. Arrêt de la reconnaissance.');
                stopFacialRecognition();
                return;
            }
            
            recognitionAttempts++;
            
            try {
                const result = await scanFaceHybrid();
                
                if (result.status === 'success') {
                    recognizedPerson = {
                        name: result.name,
                        role: result.role,
                        confidence: result.confidence,
                        method: result.method
                    };
                    
                    // Afficher des informations détaillées
                    updatePresenceStatus('success', 
                        `${result.name} (${result.role}) reconnu - ${(result.confidence * 100).toFixed(1)}% de confiance`);
                    
                    // Enregistrer automatiquement si confiance élevée
                    if (result.confidence > 0.6) {
                        setTimeout(async () => {
                            const success = await enregistrerPresence();
                            if (success) {
                                stopFacialRecognition();
                            }
                        }, 1000);
                    }
                    
                } else if (result.status === 'warning') {
                    updatePresenceStatus('warning', result.message);
                } else if (result.status === 'error') {
                    console.error('Erreur de reconnaissance:', result.message);
                }
            } catch (error) {
                console.error('Erreur lors de la détection faciale:', error);
            }
        }, 2000); // Intervalle de 2 secondes

    } catch (err) {
        console.error("Erreur d'accès à la caméra: ", err);
        
        if (err.name === 'NotAllowedError') {
            updatePresenceStatus('error', 'Accès à la caméra refusé. Veuillez autoriser l\'accès à la caméra.');
        } else if (err.name === 'NotFoundError') {
            updatePresenceStatus('error', 'Aucune caméra disponible. Veuillez connecter une caméra.');
        } else {
            updatePresenceStatus('error', 'Impossible d\'accéder à la caméra. Vérifiez les permissions.');
        }
        
        // Réinitialiser l'état en cas d'erreur
        cameraActive = false;
        if (toggleCameraBtn) {
            toggleCameraBtn.innerHTML = '<i class="material-icons">videocam</i> Démarrer la reconnaissance';
            toggleCameraBtn.classList.remove('btn-danger');
            toggleCameraBtn.classList.add('btn-primary');
        }
    }
}

/**
 * Arrête la reconnaissance faciale
 */
function stopFacialRecognition() {
    // Arrêter le flux vidéo
    if (streamPresence) {
        streamPresence.getTracks().forEach(track => track.stop());
        streamPresence = null;
    }
    
    if (intervalIdPresence) {
        clearInterval(intervalIdPresence);
        intervalIdPresence = null;
    }
    
    if (video.srcObject) {
        video.srcObject = null;
    }
    
    if (video.parentNode) {
        video.parentNode.removeChild(video);
    }
    
    if (cameraPlaceholder) {
        cameraPlaceholder.style.display = 'flex';
    }
    
    if (faceOverlay) {
        faceOverlay.classList.remove('scanning');
    }
    
    cameraActive = false;
    recognitionAttempts = 0;
    
    // Mise à jour de l'interface
    if (toggleCameraBtn) {
        toggleCameraBtn.innerHTML = '<i class="material-icons">videocam</i> Démarrer la reconnaissance';
        toggleCameraBtn.classList.remove('btn-danger');
        toggleCameraBtn.classList.add('btn-primary');
    }
}

/**
 * Arrête la reconnaissance et enregistre la présence
 */
async function stopFacialRecognitionAndSave() {
    stopFacialRecognition();
    
    // Enregistrer la présence si une personne a été reconnue
    if (recognizedPerson) {
        updatePresenceStatus('info', 'Enregistrement de la présence...');
        const success = await enregistrerPresence();
        
        if (success) {
            // Réinitialiser après enregistrement réussi
            recognizedPerson = null;
        }
    } else {
        updatePresenceStatus('warning', 'Aucune personne reconnue. Veuillez réessayer.');
    }
}

/**
 * Met à jour le message de statut
 */
function updatePresenceStatus(status, message) {
    if (!presenceStatus) return;
    presenceStatus.textContent = message;
    presenceStatus.classList.remove('text-success', 'text-warning', 'text-danger', 'text-info');
    
    const statusClasses = {
        'success': 'text-success',
        'warning': 'text-warning',
        'error': 'text-danger',
        'info': 'text-info'
    };
    
    if (statusClasses[status]) {
        presenceStatus.classList.add(statusClasses[status]);
    }
    
    // Ajouter un timestamp pour le débogage
    console.log(`${new Date().toLocaleTimeString()} - ${status}: ${message}`);
}

/**
 * Vérifie la connexion au serveur
 */
async function checkServerConnection() {
    try {
        const response = await fetch('http://localhost:5000/health', {
            method: 'GET',
            timeout: 5000
        });
        return response.ok;
    } catch (error) {
        console.error('Serveur non disponible:', error);
        return false;
    }
}

// ============================================================================================================
//                                       ÉCOUTEURS D'ÉVÉNEMENTS
// ============================================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Vérifier la connexion au serveur au chargement
    const isServerConnected = await checkServerConnection();
    if (!isServerConnected) {
        updatePresenceStatus('error', 'Serveur de reconnaissance non connecté. Démarrez reconserv.py');
    } else {
        updatePresenceStatus('info', 'Serveur connecté. Prêt pour la reconnaissance.');
    }

    // Écouteur pour le bouton de reconnaissance
    if (toggleCameraBtn) {
        toggleCameraBtn.addEventListener('click', async () => {
            if (!cameraActive) {
                const role = document.querySelector('input[name="roleRadio"]:checked')?.value;
                const type = document.querySelector('input[name="presenceType"]:checked')?.value;

                if (!role || !type) {
                    updatePresenceStatus('error', 'Veuillez sélectionner un rôle et un type de présence');
                    return;
                }

                // Vérifier à nouveau la connexion au serveur
                const isConnected = await checkServerConnection();
                if (!isConnected) {
                    updatePresenceStatus('error', 'Serveur non disponible. Impossible de démarrer la reconnaissance.');
                    return;
                }

                if (role === 'enseignant' && type === 'entry') {
                    courseModal.style.display = 'flex';
                    updatePresenceStatus('info', 'Veuillez saisir le titre du cours');
                    courseTitleInput.focus();
                } else {
                    await startFacialRecognition(role, type);
                }
            } else {
                await stopFacialRecognitionAndSave();
            }
        });
    }
    
    // Gestion de la modal du cours
    if (confirmCourseBtn) {
        confirmCourseBtn.addEventListener('click', async () => {
            const title = courseTitleInput.value.trim();
            if (title === '') {
                updatePresenceStatus('error', 'Veuillez entrer un titre pour votre cours');
                courseTitleInput.focus();
                return;
            }
            
            courseModal.style.display = 'none';
            const role = document.querySelector('input[name="roleRadio"]:checked').value;
            const type = document.querySelector('input[name="presenceType"]:checked').value;
            
            await startFacialRecognition(role, type, title);
        });
    }

    if (cancelCourseBtn) {
        cancelCourseBtn.addEventListener('click', () => {
            courseModal.style.display = 'none';
            courseTitleInput.value = '';
            updatePresenceStatus('info', 'Saisie du cours annulée');
        });
    }
    
    // Fermer le modal en cliquant à l'extérieur
    if (courseModal) {
        courseModal.addEventListener('click', (e) => {
            if (e.target === courseModal) {
                courseModal.style.display = 'none';
                courseTitleInput.value = '';
                updatePresenceStatus('info', 'Saisie du cours annulée');
            }
        });
    }

    // Recharger les visages au chargement de la page
    try {
        const response = await fetch('http://localhost:5000/reload_faces', { 
            method: 'POST',
            timeout: 10000
        });
        if (response.ok) {
            const data = await response.json();
            console.log('Visages rechargés:', data.count);
            updatePresenceStatus('info', `${data.count} visages chargés pour la reconnaissance`);
        }
    } catch (error) {
        console.error('Erreur lors du rechargement des visages:', error);
        updatePresenceStatus('warning', 'Erreur lors du chargement des visages');
    }

    // Gestion de la fermeture de la page
    window.addEventListener('beforeunload', () => {
        stopFacialRecognition();
    });
});