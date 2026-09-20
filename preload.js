const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  envoyerInscription: (data) => ipcRenderer.send('inserer-inscription', data),
  lancerReconnaissance: () => ipcRenderer.send('lancer-webcam'),
});



// const { contextBridge, ipcRenderer } = require('electron');

// contextBridge.exposeInMainWorld('electronAPI', {
//     // Méthode pour envoyer la commande de lancement au processus main
//     lancerReconnaissance: () => ipcRenderer.send('lancer-reconnaissance'),
//     // Méthode pour recevoir le résultat du processus main
//     onRecognitionResult: (callback) => ipcRenderer.on('recognition-result', (event, data) => callback(data))
// });



// const { contextBridge, ipcRenderer } = require('electron');

// // Exposition des API sécurisées au renderer process
// contextBridge.exposeInMainWorld('electronAPI', {
//   // Méthodes pour les enseignants
//   getEnseignants: () => ipcRenderer.invoke('getEnseignants'),
//   updateEnseignant: (data) => ipcRenderer.invoke('updateEnseignant', data),
//   deleteEnseignant: (id) => ipcRenderer.invoke('deleteEnseignant', id),
  
//   // Méthodes pour les étudiants
//   getEtudiants: () => ipcRenderer.invoke('getEtudiants'),
//   updateEtudiant: (data) => ipcRenderer.invoke('updateEtudiant', data),
//   deleteEtudiant: (id) => ipcRenderer.invoke('deleteEtudiant', id),
  
//   // Méthodes pour les présences
//   getPresences: () => ipcRenderer.invoke('getPresences'),
  
//   // Méthode pour l'inscription
//   insererInscription: (data) => ipcRenderer.invoke('inserer-inscription', data),
  
//   // Méthodes pour la reconnaissance faciale
//   lancerReconnaissance: () => ipcRenderer.send('lancer-reconnaissance'),
//   arreterReconnaissance: () => ipcRenderer.send('arreter-reconnaissance'),
  
//   // Écouteurs d'événements
//   onRecognitionResult: (callback) => ipcRenderer.on('recognition-result', callback),
//   removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
// });