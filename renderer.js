document.getElementById('btn-valider').addEventListener('click', () => {
  const data = {
    nom: document.getElementById('nom').value.trim(),
    prenom: document.getElementById('prenom').value.trim(),
    date_naissance: document.getElementById('date_de_nais').value,
    adresse: document.getElementById('adresse').value.trim(),
    tel: document.getElementById('tel').value.trim(),
    email: document.getElementById('email').value.trim(),
    cin: document.getElementById('cin').value.trim(),
    matricule: document.getElementById('matricule').value.trim(),
    role: document.getElementById('role').value,
    niveau: document.getElementById('niveau').value,
  };

  if (!data.nom || !data.prenom || !data.role || !data.email || !data.matricule) {
    alert("⚠️ Tous les champs obligatoires doivent être remplis !");
    return;
  }

  if (data.role === "etudiant" && !data.niveau) {
    alert("⚠️ Veuillez sélectionner un niveau pour les étudiants !");
    return;
  }

  // Envoi des données
  window.electronAPI.envoyerInscription(data);

  // Affichage alerte
  alert("Données envoyées !\n  On va prendre des photos maintenant !");

  // Simuler clic automatique sur btn-open-camera
  document.getElementById('btn-open-camera').click();
});
