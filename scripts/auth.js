/* ==========================================================================
   AUTHENTIFICATION — identifiant puis code PIN
   ========================================================================== */

function memLire(cle) {
  try { return localStorage.getItem(cle); } catch (e) { return null; }
}

function memEcrire(cle, val) {
  try { localStorage.setItem(cle, val); } catch (e) {}
}

const stepId = document.getElementById('auth-step-id');
const stepPin = document.getElementById('auth-step-pin');
const authWrapper = document.getElementById('auth-wrapper');
const appWrapper = document.getElementById('app-wrapper');
const inputId = document.getElementById('cx-id');
const btnValiderId = document.getElementById('cx-valider-id');
const errId = document.getElementById('cx-erreur-id');
const avatarPin = document.getElementById('cx-avatar');
const consignePin = document.getElementById('cx-pin-consigne');
const errPin = document.getElementById('cx-erreur-pin');
const ptsPin = document.getElementById('pin-points');
const btnRetourId = document.getElementById('cx-retour-id');

let membreEnCours = null;
let pinSaisi = '';
let modePin = 'saisie';
let premierPin = '';
let toastTimer;

function montrerToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3000);
}

function ligneVersMembre(row) {
  return {
    id: row.id,
    identifiant: row.identifiant,
    prenom: row.prenom,
    nom: row.nom || '',
    role: row.role,
    pin: row.pin === null || row.pin === undefined ? null : String(row.pin),
    statut: row.statut,
    tel: row.tel || '',
    email: row.email || '',
    fonction: row.fonction || '',
    pole: row.pole || null,
    bureau: Boolean(row.bureau),
    identifiantPerso: Boolean(row.identifiant_perso)
  };
}

async function chargerMembres() {
  const { data, error } = await window.sb.from('membres').select('*');
  if (error) {
    console.error('Erreur chargement membres', error);
    montrerToast('Connexion à la base impossible.');
    return false;
  }
  window.appState.comptesDemo = (data || []).map(ligneVersMembre);
  return true;
}

function montrerEtape(etape) {
  stepId.classList.remove('active');
  stepPin.classList.remove('active');

  setTimeout(() => {
    const versIdentifiant = etape === 'identifiant';
    stepId.classList.toggle('hidden', !versIdentifiant);
    stepPin.classList.toggle('hidden', versIdentifiant);
    const etapeActive = versIdentifiant ? stepId : stepPin;
    void etapeActive.offsetWidth;
    etapeActive.classList.add('active');
    if (versIdentifiant) setTimeout(() => inputId.focus(), 200);
  }, 60);
}

btnValiderId.addEventListener('click', async () => {
  const identifiant = inputId.value.trim().toLowerCase();
  errId.classList.remove('visible');

  if (!identifiant) {
    errId.textContent = 'Indique ton identifiant.';
    errId.classList.add('visible');
    inputId.focus();
    return;
  }

  if (!window.appState.comptesDemo.length) {
    const libelle = btnValiderId.querySelector('span');
    const texteInitial = libelle.textContent;
    libelle.textContent = 'Vérification…';
    btnValiderId.disabled = true;
    const charge = await chargerMembres();
    libelle.textContent = texteInitial;
    btnValiderId.disabled = false;
    if (!charge) return;
  }

  const membre = window.appState.comptesDemo.find(compte => compte.identifiant === identifiant);
  if (!membre) {
    errId.textContent = 'Identifiant inconnu.';
    errId.classList.add('visible');
    return;
  }

  if (['attente', 'refuse', 'inactif'].includes(membre.statut)) {
    errId.textContent = 'Ton compte n’est pas actif. Contacte le club.';
    errId.classList.add('visible');
    return;
  }

  allerAuPin(membre);
});

inputId.addEventListener('keydown', event => {
  if (event.key === 'Enter') btnValiderId.click();
});

function allerAuPin(membre) {
  membreEnCours = membre;
  pinSaisi = '';
  errPin.classList.remove('visible');
  majPoints();

  const initiales = `${membre.prenom.charAt(0)}${membre.nom ? membre.nom.charAt(0) : ''}`.toUpperCase();
  avatarPin.textContent = initiales;

  if (membre.pin === null) {
    modePin = 'creation1';
    consignePin.textContent = `Bonjour ${membre.prenom}, choisis ton code PIN`;
  } else {
    modePin = 'saisie';
    consignePin.textContent = `Bonjour ${membre.prenom}, entre ton code PIN`;
  }
  montrerEtape('pin');
}

btnRetourId.addEventListener('click', () => {
  membreEnCours = null;
  pinSaisi = '';
  majPoints();
  inputId.value = '';
  montrerEtape('identifiant');
});

function majPoints() {
  ptsPin.classList.remove('erreur');
  ptsPin.querySelectorAll('.pin-dot').forEach((point, index) => {
    point.classList.toggle('plein', index < pinSaisi.length);
  });
}

function declencherErreurPin(message) {
  errPin.textContent = message;
  errPin.classList.add('visible');
  ptsPin.classList.add('erreur');
  if (navigator.vibrate) navigator.vibrate(160);

  setTimeout(() => {
    pinSaisi = '';
    majPoints();
    errPin.classList.remove('visible');
  }, 700);
}

function validerPinComplet() {
  if (modePin === 'saisie') {
    if (pinSaisi === membreEnCours.pin) finConnexion();
    else declencherErreurPin('Code PIN incorrect.');
    return;
  }

  if (modePin === 'creation1') {
    premierPin = pinSaisi;
    pinSaisi = '';
    majPoints();
    modePin = 'creation2';
    consignePin.textContent = 'Confirme ton code PIN';
    return;
  }

  if (pinSaisi === premierPin) {
    membreEnCours.pin = premierPin;
    window.sb
      .from('membres')
      .update({ pin: premierPin })
      .eq('identifiant', membreEnCours.identifiant)
      .then(({ error }) => {
        if (error) {
          console.error('Mise à jour du PIN échouée', error);
          montrerToast('Le PIN n’a pas pu être enregistré.');
        }
      });
    finConnexion();
  } else {
    declencherErreurPin('Les deux codes ne correspondent pas.');
    modePin = 'creation1';
    consignePin.textContent = 'Choisis un nouveau code PIN';
  }
}

function ajouterChiffre(chiffre) {
  if (pinSaisi.length >= 4 || !membreEnCours) return;
  pinSaisi += chiffre;
  majPoints();
  if (pinSaisi.length === 4) setTimeout(validerPinComplet, 150);
}

document.querySelectorAll('.numpad-key').forEach(touche => {
  touche.addEventListener('click', () => {
    if (touche.classList.contains('empty')) return;
    if (touche.dataset.key === 'delete') {
      pinSaisi = pinSaisi.slice(0, -1);
      majPoints();
      return;
    }
    ajouterChiffre(touche.dataset.key);
  });
});

document.addEventListener('keydown', event => {
  if (!stepPin.classList.contains('active')) return;
  if (/^\d$/.test(event.key)) ajouterChiffre(event.key);
  if (event.key === 'Backspace') {
    pinSaisi = pinSaisi.slice(0, -1);
    majPoints();
  }
});

function finConnexion() {
  memEcrire('assopilot_session', '1');
  memEcrire('assopilot_dernier_id', membreEnCours.identifiant);

  window.appState.MOI = membreEnCours.prenom;
  window.appState.MON_ID = membreEnCours.id;
  window.appState.MON_IDENTIFIANT = membreEnCours.identifiant;
  window.appState.roleActuel = membreEnCours.role || 'benevole';
  window.appState.currentMember = membreEnCours;

  document.getElementById('accueil-bonjour').textContent = `Bonjour ${membreEnCours.prenom}`;
  const initiales = `${membreEnCours.prenom.charAt(0)}${membreEnCours.nom ? membreEnCours.nom.charAt(0) : ''}`.toUpperCase();
  document.getElementById('header-avatar').textContent = initiales;

  authWrapper.classList.remove('visible');
  setTimeout(() => {
    authWrapper.classList.add('hidden');
    appWrapper.classList.remove('hidden');
    void appWrapper.offsetWidth;
    appWrapper.classList.add('visible');
    window.initialiserAccueil?.();
    window.initialiserCreation?.();
  }, 300);
}

(async () => {
  const session = memLire('assopilot_session');
  const dernierId = memLire('assopilot_dernier_id');
  if (!dernierId) return;

  const charge = await chargerMembres();
  if (!charge) return;

  const compteConnu = window.appState.comptesDemo.find(compte => compte.identifiant === dernierId);
  if (session && compteConnu) {
    membreEnCours = compteConnu;
    finConnexion();
  } else if (compteConnu) {
    allerAuPin(compteConnu);
  }
})();
