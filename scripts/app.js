/* ==========================================================================
   ASSOPILOT V3 — accueil et missions natives
   ========================================================================== */

const btnDeco = document.getElementById('btn-deco');
const homeView = document.getElementById('home-view');
const missionsView = document.getElementById('missions-view');
const aidsView = document.getElementById('aids-view');
const profileView = document.getElementById('profile-view');
const missionsList = document.getElementById('missions-list');
const missionsLoading = document.getElementById('missions-loading');
const missionsError = document.getElementById('missions-error');
const missionsEmpty = document.getElementById('missions-empty');
const missionDialog = document.getElementById('mission-confirm');
const missionConfirmAction = document.getElementById('mission-confirm-action');

let accueilDejaCharge = false;
let missionsDejaChargees = false;
let filtreMissions = 'all';
let actionMissionEnAttente = null;

const donneesClub = {
  evenements: [],
  evenementsTous: [],
  besoins: [],
  inscriptions: [],
  groupesMembre: new Set(),
  groupes: [],
  groupeMembres: new Map(),
  poles: [],
  annonces: []
};

const LABELS_POLE = {
  sportif: 'Sportif',
  evenementiel: 'Événementiel',
  com: 'Communication',
  admin: 'Administratif'
};

function echapper(valeur) {
  return String(valeur ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function dateLocale(iso) {
  if (!iso) return null;
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function aujourdhuiISO() {
  const maintenant = new Date();
  const local = new Date(maintenant.getTime() - maintenant.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function joursAvant(iso) {
  const cible = dateLocale(iso);
  const aujourdhui = dateLocale(aujourdhuiISO());
  if (!cible || !aujourdhui) return null;
  return Math.round((cible - aujourdhui) / 86400000);
}

function tempsRestant(iso) {
  const jours = joursAvant(iso);
  if (jours === null) return 'Date à confirmer';
  if (jours < 0) return 'Passée';
  if (jours === 0) return 'Aujourd’hui';
  if (jours === 1) return 'Demain';
  if (jours <= 6) return `Dans ${jours} jours`;
  if (jours <= 13) return 'La semaine prochaine';
  return `Dans ${Math.round(jours / 7)} semaines`;
}

function dateLisible(iso) {
  const date = dateLocale(iso);
  if (!date) return 'Date à confirmer';
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(date).replace('.', '');
}

function normaliserCible(cible) {
  if (Array.isArray(cible)) return cible;
  if (!cible) return [];
  if (typeof cible === 'string') {
    try {
      const parse = JSON.parse(cible);
      return Array.isArray(parse) ? parse : cible;
    } catch (error) {
      return cible;
    }
  }
  return cible;
}

function texteNormalise(texte) {
  return String(texte || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function polesGeres() {
  const membre = window.appState.currentMember || {};
  const role = texteNormalise(membre.role);
  const fonction = texteNormalise(membre.fonction);
  const tous = Object.keys(LABELS_POLE);

  if (role === 'webmaster' || /webmaster|(^| )president|vice.?president/.test(fonction)) return tous;
  if (/directeur.*sport|adjoint.*directeur.*sport/.test(fonction)) return ['sportif'];
  if (/secretaire/.test(fonction)) return ['admin', 'evenementiel', 'sportif'];
  if (/tresori/.test(fonction)) return ['admin'];
  if (/evenementiel|buvette/.test(fonction)) return ['evenementiel'];
  if (/communication/.test(fonction)) return ['com'];
  if (/sponsors|arbitrage|materiel|officiels|comite|coq/.test(fonction)) return ['sportif'];
  if (role === 'responsable') return tous;
  return [];
}

function estVisiblePourMoi(item) {
  const membre = window.appState.currentMember || {};
  if (texteNormalise(membre.role) === 'webmaster') return true;
  if (item.pole && polesGeres().includes(item.pole)) return true;

  const groupeId = item.groupe_id || item.groupeId;
  if (groupeId && !donneesClub.groupesMembre.has(String(groupeId))) return false;

  const visibilite = item.visibilite || 'tous';
  const cible = normaliserCible(item.visibilite_cible ?? item.visibiliteCible);
  if (visibilite === 'tous') return true;
  if (visibilite === 'bureau') return Boolean(membre.bureau);
  if (visibilite === 'pole') return Boolean(membre.pole) && cible === membre.pole;
  if (visibilite === 'membres') {
    return Array.isArray(cible) && cible.map(String).includes(String(window.appState.MON_ID));
  }
  return true;
}

function iconeMission(nom) {
  const texte = texteNormalise(nom);
  if (/responsable de salle|police de terrain/.test(texte)) return 'shield-check';
  if (/table de marque|chrono|secretaire|score/.test(texte)) return 'timer';
  if (/buvette|boisson|bar/.test(texte)) return 'cup-soda';
  if (/arbitr/.test(texte)) return 'badge';
  if (/course|achat|magasin/.test(texte)) return 'shopping-basket';
  if (/ranger|local|nettoy/.test(texte)) return 'sparkles';
  if (/feuille de match|fdme|ordinateur/.test(texte)) return 'laptop';
  if (/photo|reseau|insta/.test(texte)) return 'camera';
  if (/maillot|linge|lessive|pressing/.test(texte)) return 'shirt';
  if (/transport|covoit|voiture|conduire|materiel/.test(texte)) return 'car-front';
  if (/install|salle|but|monter/.test(texte)) return 'goal';
  return 'hand-heart';
}

function urgenceMission(besoin) {
  if (besoin.urgence_forcee) return besoin.urgence_forcee;
  const jours = joursAvant(besoin.date_iso);
  if (jours !== null && jours <= 1) return 'urgent';
  if (jours !== null && jours <= 3) return 'bientot';
  return 'tranquille';
}

function compterInscriptions(inscriptions = donneesClub.inscriptions) {
  return inscriptions.reduce((compte, inscription) => {
    compte[inscription.besoin_id] = (compte[inscription.besoin_id] || 0) + 1;
    return compte;
  }, {});
}

function estInscrit(besoinId) {
  return donneesClub.inscriptions.some(inscription =>
    String(inscription.besoin_id) === String(besoinId)
    && String(inscription.membre_id) === String(window.appState.MON_ID)
  );
}

function mettreAJourDateDuJour() {
  const texte = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());
  document.getElementById('home-date').textContent = texte.charAt(0).toUpperCase() + texte.slice(1);

  const heure = new Date().getHours();
  document.getElementById('accueil-phrase').textContent = heure < 12
    ? 'Le club se met en mouvement.'
    : heure < 18
      ? 'Voici le tempo du club.'
      : 'Le club prépare la suite.';
}

function afficherProchainEvenement(evenement, besoins, inscriptionsParBesoin) {
  const chargement = document.getElementById('next-event-loading');
  const contenu = document.getElementById('next-event-content');
  const vide = document.getElementById('next-event-empty');
  chargement.classList.add('hidden');
  contenu.classList.add('hidden');
  vide.classList.add('hidden');

  if (!evenement) {
    vide.classList.remove('hidden');
    return;
  }

  const date = dateLocale(evenement.date_iso);
  const besoinsEvenement = besoins.filter(besoin => besoin.evenement_id === evenement.id && !besoin.cloture);
  const totalPlaces = besoinsEvenement.reduce((total, besoin) => total + Math.max(Number(besoin.cherche) || 0, 0), 0);
  const placesPrises = besoinsEvenement.reduce((total, besoin) => {
    return total + Math.min(inscriptionsParBesoin[besoin.id] || 0, Number(besoin.cherche) || 0);
  }, 0);
  const couverture = totalPlaces ? Math.round((placesPrises / totalPlaces) * 100) : 100;

  document.getElementById('next-event-day').textContent = date ? date.getDate() : '—';
  document.getElementById('next-event-month').textContent = date
    ? new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date).replace('.', '')
    : 'date';
  document.getElementById('next-event-title').textContent = evenement.nom;
  document.querySelector('#next-event-meta span').textContent = evenement.heure
    ? `${evenement.heure} · ${besoinsEvenement.length} mission${besoinsEvenement.length > 1 ? 's' : ''}`
    : `${besoinsEvenement.length} mission${besoinsEvenement.length > 1 ? 's' : ''} autour de ce rendez-vous`;
  document.getElementById('coverage-value').textContent = `${couverture}%`;
  document.getElementById('next-event-status').textContent = couverture === 100 ? 'Équipe prête' : 'On se mobilise';
  contenu.classList.remove('hidden');
  requestAnimationFrame(() => {
    document.getElementById('coverage-bar').style.width = `${couverture}%`;
  });
}

function afficherChiffres(evenements, besoins, inscriptions) {
  const inscriptionsParBesoin = compterInscriptions(inscriptions);
  const besoinsActifs = besoins.filter(besoin => !besoin.cloture && (!besoin.date_iso || besoin.date_iso >= aujourdhuiISO()));
  const placesOuvertes = besoinsActifs.reduce((total, besoin) => {
    return total + Math.max((Number(besoin.cherche) || 0) - (inscriptionsParBesoin[besoin.id] || 0), 0);
  }, 0);
  const besoinsCouverts = besoinsActifs.filter(besoin => {
    const cherche = Math.max(Number(besoin.cherche) || 0, 0);
    return cherche > 0 && (inscriptionsParBesoin[besoin.id] || 0) >= cherche;
  }).length;

  document.getElementById('open-needs-count').textContent = placesOuvertes;
  document.getElementById('open-needs-label').textContent = placesOuvertes
    ? `${placesOuvertes} place${placesOuvertes > 1 ? 's' : ''} encore ouverte${placesOuvertes > 1 ? 's' : ''}`
    : 'Toutes les missions sont couvertes';
  document.getElementById('events-count-label').textContent = `${evenements.length} rendez-vous à venir`;
  document.getElementById('home-members-count').textContent = window.appState.comptesDemo.length;
  document.getElementById('home-events-count').textContent = evenements.length;
  document.getElementById('home-covered-count').textContent = besoinsCouverts;

  const badge = document.getElementById('nav-needs-badge');
  badge.textContent = placesOuvertes > 99 ? '99+' : placesOuvertes;
  badge.classList.toggle('hidden', placesOuvertes === 0);
  return inscriptionsParBesoin;
}

function afficherErreurAccueil() {
  document.getElementById('next-event-loading').classList.add('hidden');
  document.getElementById('next-event-empty').classList.remove('hidden');
  document.getElementById('next-event-title-empty').textContent = 'Le terrain est momentanément inaccessible';
  document.getElementById('open-needs-count').textContent = '—';
  document.getElementById('open-needs-label').textContent = 'Réessaie dans quelques instants';
  montrerToast('Impossible de charger la vie du club.');
}

function afficherAnnoncesAccueil() {
  const zone = document.getElementById('home-announcements');
  if (!zone) return;
  const annonces = donneesClub.annonces || [];
  if (!annonces.length) {
    zone.innerHTML = '';
    zone.classList.add('hidden');
    return;
  }

  zone.innerHTML = annonces.slice(0, 3).map(annonce => `
    <article class="home-announcement ${annonce.niveau === 'urgent' ? 'urgent' : ''}">
      <span aria-hidden="true"><i data-lucide="${annonce.niveau === 'urgent' ? 'siren' : 'megaphone'}"></i></span>
      <div>
        <strong>${echapper(annonce.titre)}</strong>
        <p>${echapper(annonce.texte)}</p>
      </div>
    </article>
  `).join('');
  zone.classList.remove('hidden');
}

async function chargerDonneesClub() {
  const idMembre = window.appState.MON_ID;
  const [
    eventsResult,
    needsResult,
    registrationsResult,
    groupsMemberResult,
    groupsResult,
    allGroupMembersResult,
    polesResult,
    announcementsResult
  ] = await Promise.all([
    window.sb.from('evenements').select('*').order('date_iso', { ascending: true }),
    window.sb.from('besoins').select('*').order('date_iso', { ascending: true }),
    window.sb.from('inscriptions').select('besoin_id,membre_id'),
    window.sb.from('groupe_membres').select('groupe_id,membre_id').eq('membre_id', idMembre),
    window.sb.from('groupes').select('*').order('nom', { ascending: true }),
    window.sb.from('groupe_membres').select('groupe_id,membre_id'),
    window.sb.from('poles').select('*').order('ordre', { ascending: true }),
    window.sb.from('annonces').select('*').eq('active', true).order('cree_le', { ascending: false })
  ]);

  if (eventsResult.error || needsResult.error || registrationsResult.error) {
    throw new Error('Les données principales du club sont indisponibles.');
  }

  donneesClub.poles = polesResult.error ? [] : (polesResult.data || []);
  donneesClub.poles.forEach(pole => {
    if (pole.code && pole.libelle) LABELS_POLE[pole.code] = pole.libelle;
  });
  donneesClub.groupesMembre = new Set((groupsMemberResult.data || []).map(ligne => String(ligne.groupe_id)));
  donneesClub.groupes = groupsResult.error ? [] : (groupsResult.data || []);
  donneesClub.groupeMembres = new Map();
  (allGroupMembersResult.data || []).forEach(ligne => {
    const cle = String(ligne.groupe_id);
    if (!donneesClub.groupeMembres.has(cle)) donneesClub.groupeMembres.set(cle, []);
    donneesClub.groupeMembres.get(cle).push(ligne.membre_id);
  });
  donneesClub.annonces = announcementsResult.error ? [] : (announcementsResult.data || []);
  donneesClub.evenementsTous = (eventsResult.data || []).filter(estVisiblePourMoi);
  donneesClub.evenements = donneesClub.evenementsTous.filter(evenement =>
    !evenement.date_iso || evenement.date_iso >= aujourdhuiISO()
  );
  donneesClub.besoins = (needsResult.data || []).filter(estVisiblePourMoi);
  donneesClub.inscriptions = registrationsResult.data || [];
}

window.initialiserAccueil = async function initialiserAccueil(forcer = false) {
  mettreAJourDateDuJour();
  if (accueilDejaCharge && !forcer) return;
  accueilDejaCharge = true;

  try {
    await chargerDonneesClub();
    const inscriptionsParBesoin = afficherChiffres(
      donneesClub.evenements,
      donneesClub.besoins,
      donneesClub.inscriptions
    );
    afficherProchainEvenement(
      donneesClub.evenements[0],
      donneesClub.besoins,
      inscriptionsParBesoin
    );
    afficherAnnoncesAccueil();
    window.mettreAJourCreationSelonDroits?.();
    lucide.createIcons();
  } catch (error) {
    console.error('Chargement accueil impossible', error);
    accueilDejaCharge = false;
    afficherErreurAccueil();
  }
};

function missionsAffichables() {
  const inscritsParBesoin = compterInscriptions();
  return donneesClub.besoins
    .filter(besoin => {
      const passee = besoin.date_iso && besoin.date_iso < aujourdhuiISO();
      const inscrit = estInscrit(besoin.id);
      const reste = Math.max((Number(besoin.cherche) || 0) - (inscritsParBesoin[besoin.id] || 0), 0);
      return !passee && !besoin.cloture && (reste > 0 || inscrit);
    })
    .filter(besoin => {
      const jours = joursAvant(besoin.date_iso);
      if (filtreMissions === 'urgent') return urgenceMission(besoin) === 'urgent';
      if (filtreMissions === 'week') return jours === null || jours <= 7;
      if (filtreMissions === 'mine') return estInscrit(besoin.id);
      return true;
    });
}

function participantsPour(besoinId) {
  const ids = donneesClub.inscriptions
    .filter(inscription => String(inscription.besoin_id) === String(besoinId))
    .map(inscription => String(inscription.membre_id));
  return ids.map(id => window.appState.comptesDemo.find(membre => String(membre.id) === id)).filter(Boolean);
}

function markupMission(besoin) {
  const participants = participantsPour(besoin.id);
  const cherche = Math.max(Number(besoin.cherche) || 0, 0);
  const inscrits = participants.length;
  const reste = Math.max(cherche - inscrits, 0);
  const progression = cherche ? Math.min(Math.round((inscrits / cherche) * 100), 100) : 100;
  const inscrit = estInscrit(besoin.id);
  const urgence = urgenceMission(besoin);
  const responsable = besoin.responsable_id
    ? window.appState.comptesDemo.find(membre => String(membre.id) === String(besoin.responsable_id))
    : null;
  const noms = participants.slice(0, 3).map(membre => echapper(membre.prenom)).join(', ');

  return `
    <article class="mission-card physical-card ${inscrit ? 'is-mine' : ''}" data-mission-card="${echapper(besoin.id)}">
      <div class="mission-card-head">
        <span class="mission-icon"><i data-lucide="${iconeMission(besoin.nom)}"></i></span>
        <div class="mission-title-block">
          <div class="mission-badges">
            <span class="urgency-badge urgency-${echapper(urgence)}">${urgence === 'urgent' ? 'Urgent' : urgence === 'bientot' ? 'Bientôt' : 'À venir'}</span>
            ${inscrit ? '<span class="mine-badge"><i data-lucide="check"></i> Inscrit</span>' : ''}
          </div>
          <h3>${echapper(besoin.nom)}</h3>
        </div>
      </div>

      <div class="mission-meta">
        <span><i data-lucide="calendar-days"></i>${echapper(tempsRestant(besoin.date_iso))}</span>
        <span><i data-lucide="clock-3"></i>${echapper(besoin.duree || 'Durée à confirmer')}</span>
        <span><i data-lucide="layers-3"></i>${echapper(LABELS_POLE[besoin.pole] || besoin.pole || 'Club')}</span>
      </div>

      ${besoin.precisions ? `<p class="mission-note">${echapper(besoin.precisions)}</p>` : ''}

      <div class="mission-coverage">
        <div class="mission-coverage-label">
          <span>${reste ? `${reste} place${reste > 1 ? 's' : ''} à prendre` : 'Équipe complète'}</span>
          <strong>${inscrits}/${cherche}</strong>
        </div>
        <div class="mission-progress"><span style="width:${progression}%"></span></div>
        ${noms ? `<small>${noms}${participants.length > 3 ? ` +${participants.length - 3}` : ''}</small>` : '<small>Sois la première personne à aider</small>'}
      </div>

      <div class="mission-card-footer">
        <span>${responsable ? `Avec ${echapper(responsable.prenom)}` : echapper(dateLisible(besoin.date_iso))}</span>
        <button class="mission-toggle ${inscrit ? 'is-withdraw' : ''}" data-mission-toggle="${echapper(besoin.id)}">
          <i data-lucide="${inscrit ? 'undo-2' : 'hand-heart'}"></i>
          ${inscrit ? 'Me retirer' : 'Je participe'}
        </button>
      </div>

      ${window.ajouterBoutonsGestion?.(besoin.id, besoin.pole) || ''}
    </article>
  `;
}

function afficherMissions() {
  const missions = missionsAffichables();
  const toutes = donneesClub.besoins.filter(besoin =>
    !besoin.cloture && (!besoin.date_iso || besoin.date_iso >= aujourdhuiISO())
  );
  const comptes = compterInscriptions();
  const places = toutes.reduce((total, besoin) => {
    return total + Math.max((Number(besoin.cherche) || 0) - (comptes[besoin.id] || 0), 0);
  }, 0);
  const miennes = toutes.filter(besoin => estInscrit(besoin.id)).length;

  document.getElementById('missions-open-count').textContent = places;
  document.getElementById('missions-mine-count').textContent = miennes;
  missionsLoading.classList.add('hidden');
  missionsError.classList.add('hidden');

  if (!missions.length) {
    missionsList.innerHTML = '';
    document.getElementById('missions-empty-copy').textContent = filtreMissions === 'mine'
      ? 'Tu n’as pas encore choisi de mission.'
      : 'Aucune mission ne correspond à ce filtre.';
    missionsEmpty.classList.remove('hidden');
    return;
  }

  missionsEmpty.classList.add('hidden');
  const parEvenement = new Map();
  const sansEvenement = [];

  missions.forEach(besoin => {
    if (!besoin.evenement_id) {
      sansEvenement.push(besoin);
      return;
    }
    if (!parEvenement.has(besoin.evenement_id)) parEvenement.set(besoin.evenement_id, []);
    parEvenement.get(besoin.evenement_id).push(besoin);
  });

  let html = '';
  donneesClub.evenements.forEach(evenement => {
    const besoins = parEvenement.get(evenement.id);
    if (!besoins?.length) return;
    html += `
      <section class="mission-group" aria-labelledby="event-${echapper(evenement.id)}">
        <header class="mission-group-header">
          <span class="event-mini-date"><strong>${dateLocale(evenement.date_iso)?.getDate() || '—'}</strong><small>${dateLocale(evenement.date_iso) ? new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(dateLocale(evenement.date_iso)).replace('.', '') : ''}</small></span>
          <div>
            <p>${echapper(tempsRestant(evenement.date_iso))}</p>
            <h2 id="event-${echapper(evenement.id)}">${echapper(evenement.nom)}</h2>
          </div>
        </header>
        <div class="mission-group-cards">${besoins.map(markupMission).join('')}</div>
      </section>
    `;
  });

  if (sansEvenement.length) {
    html += `
      <section class="mission-group" aria-labelledby="missions-club-title">
        <header class="mission-group-header mission-group-free">
          <span class="event-mini-date"><i data-lucide="users-round"></i></span>
          <div><p>Au quotidien</p><h2 id="missions-club-title">Pour le club</h2></div>
        </header>
        <div class="mission-group-cards">${sansEvenement.map(markupMission).join('')}</div>
      </section>
    `;
  }

  missionsList.innerHTML = html;
  lucide.createIcons();
}

async function chargerMissions(forcer = false) {
  if (missionsDejaChargees && !forcer) {
    afficherMissions();
    return;
  }

  missionsLoading.classList.remove('hidden');
  missionsError.classList.add('hidden');
  missionsEmpty.classList.add('hidden');
  missionsList.innerHTML = '';

  try {
    await chargerDonneesClub();
    missionsDejaChargees = true;
    afficherMissions();
    afficherChiffres(donneesClub.evenements, donneesClub.besoins, donneesClub.inscriptions);
  } catch (error) {
    console.error('Chargement missions impossible', error);
    missionsLoading.classList.add('hidden');
    missionsError.classList.remove('hidden');
    lucide.createIcons();
  }
}

function mettreAJourNavigation(action) {
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    const actif = item.dataset.action === action;
    item.classList.toggle('active', actif);
    if (actif) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
}

function afficherVue(action) {
  const vue = ['home', 'missions', 'aids', 'profile'].includes(action) ? action : 'home';
  homeView.classList.toggle('hidden', vue !== 'home');
  missionsView.classList.toggle('hidden', vue !== 'missions');
  aidsView?.classList.toggle('hidden', vue !== 'aids');
  profileView?.classList.toggle('hidden', vue !== 'profile');
  mettreAJourNavigation(vue);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (vue === 'missions') chargerMissions();
  if (vue === 'aids') window.initialiserMesAides?.();
  if (vue === 'profile') window.initialiserProfil?.();
}

window.AssopilotV3 = {
  obtenirDonneesClub: () => donneesClub,
  obtenirPolesGeres: () => polesGeres(),
  obtenirLabelsPole: () => ({ ...LABELS_POLE }),
  ouvrirConfirmationMission,
  afficherVue,
  rechargerDonnees: async () => {
    accueilDejaCharge = false;
    missionsDejaChargees = false;
    await chargerDonneesClub();
    const inscriptionsParBesoin = afficherChiffres(
      donneesClub.evenements,
      donneesClub.besoins,
      donneesClub.inscriptions
    );
    afficherProchainEvenement(
      donneesClub.evenements[0],
      donneesClub.besoins,
      inscriptionsParBesoin
    );
    afficherAnnoncesAccueil();
    accueilDejaCharge = true;
    if (!missionsView.classList.contains('hidden')) {
      missionsDejaChargees = true;
      afficherMissions();
    }
    if (!aidsView?.classList.contains('hidden')) window.rafraichirMesAides?.();
    if (!profileView?.classList.contains('hidden')) window.rafraichirProfil?.();
    lucide.createIcons();
  }
};

function ouvrirConfirmationMission(id) {
  const besoin = donneesClub.besoins.find(item => String(item.id) === String(id));
  if (!besoin) return;
  const retrait = estInscrit(besoin.id);
  actionMissionEnAttente = { besoin, retrait };
  document.getElementById('mission-confirm-title').textContent = retrait ? 'Te retirer de cette mission ?' : 'Confirmer ce coup de main ?';
  document.getElementById('mission-confirm-copy').textContent = retrait
    ? `Ta place pour « ${besoin.nom} » sera de nouveau disponible.`
    : `Tu t’engages pour « ${besoin.nom} ».`;
  missionConfirmAction.textContent = retrait ? 'Oui, me retirer' : 'Je confirme';
  missionConfirmAction.classList.toggle('danger', retrait);
  missionDialog.classList.remove('hidden');
  document.body.classList.add('dialog-open');
  requestAnimationFrame(() => missionConfirmAction.focus());
}

function fermerConfirmationMission() {
  missionDialog.classList.add('hidden');
  document.body.classList.remove('dialog-open');
  actionMissionEnAttente = null;
}

async function confirmerMission() {
  if (!actionMissionEnAttente || !window.appState.MON_ID) {
    fermerConfirmationMission();
    montrerToast('Ta session a expiré. Reconnecte-toi.');
    return;
  }

  const { besoin, retrait } = actionMissionEnAttente;
  missionConfirmAction.disabled = true;
  missionConfirmAction.textContent = retrait ? 'Retrait…' : 'Inscription…';

  const requete = retrait
    ? window.sb.from('inscriptions').delete().eq('besoin_id', besoin.id).eq('membre_id', window.appState.MON_ID)
    : window.sb.from('inscriptions').insert({ besoin_id: besoin.id, membre_id: window.appState.MON_ID });
  const { error } = await requete;

  missionConfirmAction.disabled = false;
  if (error && error.code !== '23505') {
    console.error('Action mission impossible', error);
    missionConfirmAction.textContent = retrait ? 'Oui, me retirer' : 'Je confirme';
    montrerToast('Impossible d’enregistrer ce choix.');
    return;
  }

  fermerConfirmationMission();
  accueilDejaCharge = false;
  missionsDejaChargees = false;
  await chargerMissions(true);
  window.initialiserAccueil(true);
  window.rafraichirMesAides?.();
  window.rafraichirProfil?.();
  montrerToast(retrait ? 'Ta place est de nouveau disponible.' : 'Merci, ton coup de main est confirmé !');
}

document.querySelectorAll('[data-action]').forEach(bouton => {
  bouton.addEventListener('click', () => {
    const action = bouton.dataset.action;
    if (action === 'home') {
      afficherVue('home');
      return;
    }
  if (action === 'missions' || action === 'agenda') {
      afficherVue('missions');
      return;
    }
    if (action === 'aids' || action === 'profile') {
      afficherVue(action);
      return;
    }
    if (action === 'create') return;
    montrerToast('Cette section arrive dans la prochaine étape.');
  });
});

document.querySelectorAll('[data-mission-filter]').forEach(bouton => {
  bouton.addEventListener('click', () => {
    filtreMissions = bouton.dataset.missionFilter;
    document.querySelectorAll('[data-mission-filter]').forEach(item => {
      const actif = item === bouton;
      item.classList.toggle('active', actif);
      item.setAttribute('aria-pressed', String(actif));
    });
    afficherMissions();
  });
});

missionsList.addEventListener('click', event => {
  const bouton = event.target.closest('[data-mission-toggle]');
  if (bouton) ouvrirConfirmationMission(bouton.dataset.missionToggle);
});

document.getElementById('missions-retry').addEventListener('click', () => chargerMissions(true));
document.querySelectorAll('[data-dialog-close]').forEach(bouton => bouton.addEventListener('click', fermerConfirmationMission));
missionConfirmAction.addEventListener('click', confirmerMission);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !missionDialog.classList.contains('hidden')) fermerConfirmationMission();
});

window.deconnecterAssopilot = function deconnecterAssopilot() {
    try { localStorage.removeItem('assopilot_session'); } catch (error) {}
    window.appState.MOI = '';
    window.appState.MON_ID = null;
    window.appState.currentMember = null;
    accueilDejaCharge = false;
    missionsDejaChargees = false;
    afficherVue('home');

    const app = document.getElementById('app-wrapper');
    const auth = document.getElementById('auth-wrapper');
    app.classList.remove('visible');

    setTimeout(() => {
      app.classList.add('hidden');
      auth.classList.remove('hidden');
      void auth.offsetWidth;
      auth.classList.add('visible');

      const dernierId = localStorage.getItem('assopilot_dernier_id');
      const compteConnu = dernierId
        ? window.appState.comptesDemo.find(compte => compte.identifiant === dernierId)
        : null;
      if (compteConnu && typeof allerAuPin === 'function') allerAuPin(compteConnu);
      else montrerEtape('identifiant');
    }, 300);
};

if (btnDeco) {
  btnDeco.addEventListener('click', window.deconnecterAssopilot);
}
