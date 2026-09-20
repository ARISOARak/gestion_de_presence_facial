const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
// const { Pool } = require('pg');
const { Client } = require('pg');
const { spawn } = require('child_process');

let mainWindow;
// let pool; // Utilisation d'un pool de connexion pour une meilleure performance
let client;
// let pythonProcess = null;
let isWebcamRunning = false;

// Connexion PostgreSQL
async function connectToPostgres() {
  client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'pointage',
    password: '3001',
    port: 5432,
  });

  try {
    await client.connect();
    console.log('✅ Connecté à PostgreSQL');
  } catch (error) {
    console.error('❌ Connexion PostgreSQL échouée :', error);
  }
}

// Crée la fenêtre principale
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
}

// ======================================
// === Implémentation de l'API CRUD ===
// ======================================

// Lecture des données (READ)
ipcMain.handle('getEnseignants', async () => {
  try {
    const res = await pool.query('SELECT id, nom, prenom, email, contact FROM enseignants ORDER BY nom');
    return res.rows;
  } catch (err) {
    console.error('Erreur de lecture des enseignants', err);
    return [];
  }
});

ipcMain.handle('getEtudiants', async () => {
  try {
    const res = await pool.query('SELECT id, nom, prenom, email, niveau FROM etudiants ORDER BY nom');
    return res.rows;
  } catch (err) {
    console.error('Erreur de lecture des étudiants', err);
    return [];
  }
});
ipcMain.handle('getPresences', async () => {
  try {
    const res = await pool.query('SELECT id, nom, role, date_presence,heure_presence FROM presences ORDER BY date_presence');
    return res.rows;
  } catch (err) {
    console.error('Erreur de lecture des étudiants', err);
    return [];
  }
});

// Mise à jour des données (UPDATE)
ipcMain.handle('updateEnseignant', async (event, data) => {
  try {
    const { id, nom, prenom, email, contact } = data;
    const query = 'UPDATE enseignants SET nom = $1, prenom = $2, email = $3, contact = $4 WHERE id = $5 RETURNING *';
    const res = await pool.query(query, [nom, prenom, email, contact, id]);
    console.log('✅ Enseignant mis à jour :', res.rows[0]);
    return { success: true };
  } catch (err) {
    console.error('❌ Erreur de mise à jour de l\'enseignant', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('updateEtudiant', async (event, data) => {
  try {
    const { id, nom, prenom, email, niveau } = data;
    const query = 'UPDATE etudiants SET nom = $1, prenom = $2, email = $3, niveau = $4 WHERE id = $5 RETURNING *';
    const res = await pool.query(query, [nom, prenom, email, niveau, id]);
    console.log('✅ Étudiant mis à jour :', res.rows[0]);
    return { success: true };
  } catch (err) {
    console.error('❌ Erreur de mise à jour de l\'étudiant', err);
    return { success: false, error: err.message };
  }
});

// Suppression des données (DELETE)
ipcMain.handle('deleteEnseignant', async (event, id) => {
  try {
    const query = 'DELETE FROM enseignants WHERE id = $1';
    await pool.query(query, [id]);
    console.log(`✅ Enseignant avec l'ID ${id} supprimé.`);
    return { success: true };
  } catch (err) {
    console.error('❌ Erreur de suppression de l\'enseignant', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('deleteEtudiant', async (event, id) => {
  try {
    const query = 'DELETE FROM etudiants WHERE id = $1';
    await pool.query(query, [id]);
    console.log(`✅ Étudiant avec l'ID ${id} supprimé.`);
    return { success: true };
  } catch (err) {
    console.error('❌ Erreur de suppression de l\'étudiant', err);
    return { success: false, error: err.message };
  }
});

// L'écouteur `ipcMain.on` pour l'inscription reste inchangé, mais nous ajoutons un `await` pour l'insertion
ipcMain.on('inserer-inscription', async (event, data) => {
  const {
    nom, prenom, date_naissance, adresse, tel, email,
    cin, matricule, role, niveau
  } = data;

  try {
    if (role === 'etudiant') {
      await client.query(`
        INSERT INTO etudiants (nom, prenom, date_naissance, adresse, tel, email, cin, matricule, niveau)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [nom, prenom, date_naissance, adresse, tel, email, cin, matricule, niveau]);
      console.log("✅ Étudiant inséré avec succès");
    } else if (role === 'professeur') {
      await client.query(`
        INSERT INTO enseignants (nom, prenom, date_naissance, adresse, tel, email, cin, matricule)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [nom, prenom, date_naissance, adresse, tel, email, cin, matricule]);
      console.log("✅ Professeur inséré avec succès");
    } else {
      console.warn("❌ Rôle invalide :", role);
    }
  } catch (err) {
    console.error("❌ Erreur d'insertion :", err);
  }
});


// Lancer la reconnaissance faciale
ipcMain.on('lancer-reconnaissance', () => {
  // Si le processus Python est déjà en cours, on ne le relance pas
  if (pythonProcess && !pythonProcess.killed) {
    console.log("⏳ Le processus de reconnaissance est déjà en cours.");
    return;
  }

  console.log("🚀 Lancement de CNNtest.py...");
  
  // Spécifiez l'interpréteur Python correct si besoin (ex: 'python3')
  pythonProcess = spawn('python', ['CNNtest.py']);

  // Écoute les données de la sortie standard du script Python
  pythonProcess.stdout.on('data', (data) => {
    try {
      const result = JSON.parse(data.toString());
      // Envoie le résultat JSON au processus de rendu (renderer)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('recognition-result', result);
      }
    } catch (e) {
      console.error('❌ Erreur de parsing JSON:', e);
      console.error('Données reçues:', data.toString());
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('recognition-result', { status: 'error', message: 'Erreur de communication avec le script Python.' });
      }
    }
  });
});

// Démarrage de l’application
app.whenReady().then(async () => {
  await connectToPostgres();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Fermeture propre
app.on('window-all-closed', async () => {
  if (pool) {
    await pool.end();
    console.log('🔌 Connexion PostgreSQL fermée.');
  }
  if (pythonProcess) {
    pythonProcess.kill();
    console.log('💀 Processus Python terminé.');
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
})