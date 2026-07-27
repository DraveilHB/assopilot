/* ==========================================================================
   ASSOPILOT V3 — module de création natif
   ========================================================================== */

const createOverlay = document.getElementById('create-overlay');
const createSheet = createOverlay.querySelector('.create-sheet');
const createButton = document.querySelector('.nav-create[data-action="create"]');
const createBack = document.getElementById('create-back');
const createTitle = document.getElementById('create-sheet-title');
const createKicker = document.getElementById('create-kicker');
const createPanels = [...document.querySelectorAll('.create-panel')];
const needForm = document.getElementById('create-need-form');
const eventForm = document.getElementById('create-event-form');
const announcementForm = document.getElementById('create-announcement-form');

let createPanel = 'hub';
let needStep = 1;
let eventStep = 1;
let selectedEventType = null;
const visibilityState = { need: 'tous', event: 'tous' };

const NEED_TEMPLATES = {
  salle: { nom: 'Responsable de salle', pole: 'evenementiel', duree: '2 h', cherche: 1 },
  table: { nom: 'Table de marque (2 pers.)', pole: 'sportif', duree: '2 h', cherche: 2 },
  buvette: { nom: 'Tenir la buvette', pole: 'evenementiel', duree: '2 h', cherche: 2 },
  arbitrage: { nom: 'Arbitrage', pole: 'sportif', duree: '2 h', cherche: 1 },
  courses: { nom: 'Faire les courses', pole: 'evenementiel', duree: '1 h', cherche: 1 },
  local: { nom: 'Ranger le local', pole: 'evenementiel', duree: '1 h', cherche: 2 },
  coaching: { nom: 'Coup de main coaching', pole: 'sportif', duree: '2 h', cherche: 1 },
  feuille: { nom: 'Mettre à jour la feuille de match', pole: 'sportif', duree: '5 min', cherche: 1 }
};

const EVENT_TYPES = {
  match: { label: 'Match', emoji: '🏐', nom: 'Match ', visibilite: 'tous' },
  tournoi: { label: 'Tournoi', emoji: '🏆', nom: 'Tournoi ', visibilite: 'tous' },
  stage: { label: 'Stage', emoji: '💪', nom: 'Stage ', visibilite: 'tous' },
  reunion: { label: 'Réunion / AG', emoji: '📋', nom: 'Réunion', visibilite: 'bureau' },
  fete: { label: 'Fête', emoji: '🎉', nom: 'Fête du club', visibilite: 'tous' },
  autre: { label: 'Autre', emoji: '📅', nom: '', visibilite: 'tous' }
};

const AUTO_NEEDS = {
  match: [
    { nom: 'Table de marque', pole: 'sportif', duree: '2 h', cherche: 2 },
    { nom: 'Responsable de salle', pole: 'evenementiel', duree: '2 h', cherche: 1 },
    { nom: 'Tenir la buvette', pole: 'evenementiel', duree: '2 h', cherche: 2 },
    {
      nom: 'Mise à jour feuilles de match (ordinateur)',
      pole: 'sportif',
      duree: '30 min',
      cherche: 1,
      veille: true,
      precisions: 'À faire la veille du match : téléchargement des feuilles de match sur l’ordinateur du club.'
    }
  ],
  tournoi: [
    { nom: 'Tenir la buvette', pole: 'evenementiel', duree: '3 h', cherche: 3 },
    { nom: 'Installation de la salle', pole: 'evenementiel', duree: '1 h', cherche: 3 },
    { nom: 'Table de marque', pole: 'sportif', duree: '3 h', cherche: 2 },
    { nom: 'Photos pour les réseaux', pole: 'com', duree: '2 h', cherche: 1 }
  ],
  fete: [
    { nom: 'Tenir la buvette', pole: 'evenementiel', duree: '3 h', cherche: 3 },
    { nom: 'Installation', pole: 'evenementiel', duree: '2 h', cherche: 4 },
    { nom: 'Rangement', pole: 'evenementiel', duree: '1 h', cherche: 4 },
    { nom: 'Photos pour les réseaux', pole: 'com', duree: '1 h', cherche: 1 }
  ],
  stage: [
    { nom: 'Coup de main coaching', pole: 'sportif', duree: '2 h', cherche: 2 },
    { nom: 'Goûter des enfants', pole: 'evenementiel', duree: '1 h', cherche: 1 }
  ],
  reunion: [],
  autre: []
};

function createEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getClubData() {
  return window.AssopilotV3?.obtenirDonneesClub?.() || {
    evenements: [],
    groupes: [],
    groupeMembres: new Map()
  };
}

function getManagedPoles() {
  return window.AssopilotV3?.obtenirPolesGeres?.() || [];
}

function getPoleLabels() {
  return window.AssopilotV3?.obtenirLabelsPole?.() || {};
}

function validMembers() {
  return (window.appState.comptesDemo || [])
    .filter(member => !['attente', 'refuse', 'inactif'].includes(member.statut))
    .sort((a, b) => `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, 'fr'));
}

function setButtonLoading(button, loading, text) {
  if (!button.dataset.initialLabel) button.dataset.initialLabel = button.innerHTML;
  button.disabled = loading;
  button.innerHTML = loading
    ? `<span class="create-loading-dot" aria-hidden="true"></span>${createEscape(text)}`
    : button.dataset.initialLabel;
  if (!loading) lucide.createIcons();
}

function clearErrors(form) {
  form.querySelectorAll('.create-field-error').forEach(error => {
    error.textContent = '';
    error.classList.remove('visible');
  });
  form.querySelectorAll('.create-field.has-error').forEach(field => field.classList.remove('has-error'));
}

function showError(id, message) {
  const error = document.querySelector(`[data-error-for="${id}"]`);
  if (!error) return;
  error.textContent = message;
  error.classList.add('visible');
  const field = document.getElementById(id)?.closest('.create-field');
  field?.classList.add('has-error');
}

function focusFirstError(form) {
  const error = form.querySelector('.create-field-error.visible');
  const control = error?.closest('.create-field')?.querySelector('input, select, textarea');
  control?.focus();
}

function populateSelect(select, options, emptyLabel = null) {
  if (!select) return;
  const previous = select.value;
  const empty = emptyLabel === null ? '' : `<option value="">${createEscape(emptyLabel)}</option>`;
  select.innerHTML = empty + options.map(option =>
    `<option value="${createEscape(option.value)}">${createEscape(option.label)}</option>`
  ).join('');
  if (options.some(option => String(option.value) === previous)) select.value = previous;
}

function populateCreationData() {
  const data = getClubData();
  const poleLabels = getPoleLabels();
  const managedPoles = getManagedPoles();
  const allPoles = Object.keys(poleLabels);

  populateSelect(
    document.getElementById('need-pole'),
    managedPoles.map(code => ({ value: code, label: poleLabels[code] || code }))
  );
  populateSelect(
    document.getElementById('event-pole'),
    managedPoles.map(code => ({ value: code, label: poleLabels[code] || code }))
  );
  ['need-visibility-pole', 'event-visibility-pole'].forEach(id => {
    populateSelect(
      document.getElementById(id),
      allPoles.map(code => ({ value: code, label: poleLabels[code] || code }))
    );
  });

  populateSelect(
    document.getElementById('need-event'),
    (data.evenements || []).map(event => ({
      value: event.id,
      label: `${event.nom} · ${dateForDisplay(event.date_iso)}`
    })),
    'Aucun — coup de main libre'
  );
  populateSelect(
    document.getElementById('need-group'),
    (data.groupes || []).map(group => ({
      value: group.id,
      label: group.pole
        ? `${group.nom} · ${poleLabels[group.pole] || group.pole}`
        : group.nom
    })),
    'Ouvert à tous'
  );
  populateSelect(
    document.getElementById('need-manager'),
    validMembers().map(member => ({
      value: member.id,
      label: `${member.prenom}${member.nom ? ` ${member.nom}` : ''}`
    })),
    'Aucun responsable désigné'
  );

  const memberMarkup = validMembers().map(member => `
    <label class="member-check">
      <input type="checkbox" value="${createEscape(member.id)}">
      <span>${createEscape(member.prenom)}${member.nom ? ` ${createEscape(member.nom)}` : ''}</span>
    </label>
  `).join('');
  document.getElementById('need-visibility-members').innerHTML = memberMarkup;
  document.getElementById('event-visibility-members').innerHTML = memberMarkup;
}

function dateForDisplay(iso) {
  if (!iso) return 'date à confirmer';
  const date = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
    .format(date)
    .replace('.', '');
}

function localISO(date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
}

function minusOneDay(iso) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return localISO(date);
}

function setCreatePanel(panel) {
  createPanel = panel;
  createPanels.forEach(element => {
    const active = element.id === `create-${panel}` || (panel === 'hub' && element.id === 'create-hub');
    element.classList.toggle('active', active);
  });

  const meta = {
    hub: ['Action rapide', 'Créer'],
    'need-form': ['Nouveau besoin', 'Un coup de main'],
    'event-form': ['Nouvel événement', 'Un temps fort'],
    'announcement-form': ['Nouvelle annonce', 'Informer le club']
  }[panel];
  createKicker.textContent = meta[0];
  createTitle.textContent = meta[1];
  createBack.classList.toggle('hidden', panel === 'hub');
  createSheet.scrollTop = 0;
  lucide.createIcons();
}

function resetNeedForm() {
  needForm.reset();
  document.getElementById('need-count').value = 2;
  document.querySelectorAll('[data-need-template]').forEach(button => button.classList.remove('selected'));
  visibilityState.need = 'tous';
  setVisibility('need', 'tous');
  showNeedStep(1);
  clearErrors(needForm);
}

function resetEventForm() {
  eventForm.reset();
  selectedEventType = null;
  document.querySelectorAll('[data-event-type]').forEach(button => button.classList.remove('selected'));
  document.getElementById('event-auto-needs').classList.add('hidden');
  document.getElementById('event-auto-needs').innerHTML = '';
  visibilityState.event = 'tous';
  setVisibility('event', 'tous');
  showEventStep(1);
  clearErrors(eventForm);
}

function resetAnnouncementForm() {
  announcementForm.reset();
  clearErrors(announcementForm);
}

function openCreation() {
  if (!getManagedPoles().length) {
    montrerToast('La création est réservée aux responsables du club.');
    return;
  }
  populateCreationData();
  resetNeedForm();
  resetEventForm();
  resetAnnouncementForm();
  setCreatePanel('hub');
  createOverlay.classList.remove('hidden');
  createOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('create-open');
  createButton.classList.add('is-open');
  requestAnimationFrame(() => createOverlay.querySelector('[data-create-kind]')?.focus());
}

window.ouvrirCreationV3 = function ouvrirCreationV3(kind = 'hub') {
  openCreation();
  if (createOverlay.classList.contains('hidden') || kind === 'hub') return;
  if (['need', 'event', 'announcement', 'member'].includes(kind)) {
    const panelId = kind === 'need' ? 'need-form'
      : kind === 'event' ? 'event-form'
      : kind === 'announcement' ? 'announcement-form'
      : 'member-form';
    setCreatePanel(panelId);
  }
};

function closeCreation() {
  createOverlay.classList.add('hidden');
  createOverlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('create-open');
  createButton.classList.remove('is-open');
  createButton.focus();
}

function showNeedStep(step) {
  needStep = Math.max(1, Math.min(3, step));
  needForm.querySelectorAll('[data-need-step]').forEach(section => {
    section.classList.toggle('active', Number(section.dataset.needStep) === needStep);
  });
  needForm.querySelectorAll('.create-progress span').forEach((bar, index) => {
    bar.classList.toggle('active', index < needStep);
  });
  needForm.querySelector('[data-form-next="need"]').classList.toggle('hidden', needStep === 3);
  needForm.querySelector('button[type="submit"]').classList.toggle('hidden', needStep !== 3);
  needForm.querySelector('[data-form-back="need"]').textContent = needStep === 1 ? 'Choix' : 'Retour';
  createSheet.scrollTop = 0;
}

function showEventStep(step) {
  eventStep = Math.max(1, Math.min(4, step));
  eventForm.querySelectorAll('[data-event-step]').forEach(section => {
    section.classList.toggle('active', Number(section.dataset.eventStep) === eventStep);
  });
  eventForm.querySelectorAll('.create-progress span').forEach((bar, index) => {
    bar.classList.toggle('active', index < eventStep);
  });
  eventForm.querySelector('[data-form-next="event"]').classList.toggle('hidden', eventStep === 4);
  eventForm.querySelector('button[type="submit"]').classList.toggle('hidden', eventStep !== 4);
  eventForm.querySelector('[data-form-back="event"]').textContent = eventStep === 1 ? 'Choix' : 'Retour';
  if (eventStep === 4) renderEventRecap();
  createSheet.scrollTop = 0;
}

function validateNeedStep() {
  clearErrors(needForm);
  if (needStep === 1 && !document.getElementById('need-name').value.trim()) {
    showError('need-name', 'Donne un nom à ce besoin.');
    focusFirstError(needForm);
    return false;
  }
  if (needStep === 2) {
    const count = Number(document.getElementById('need-count').value);
    const pole = document.getElementById('need-pole').value;
    if (!Number.isInteger(count) || count < 1) showError('need-count', 'Indique au moins une personne.');
    if (!pole) showError('need-pole', 'Choisis un pôle.');
    if (needForm.querySelector('.create-field-error.visible')) {
      focusFirstError(needForm);
      return false;
    }
  }
  return true;
}

function validateEventStep() {
  clearErrors(eventForm);
  if (eventStep === 1 && !selectedEventType) showError('event-type', 'Choisis un type d’événement.');
  if (eventStep === 2 && !document.getElementById('event-date').value) showError('event-date', 'Choisis une date.');
  if (eventStep === 3) {
    if (!document.getElementById('event-name').value.trim()) showError('event-name', 'Donne un nom à l’événement.');
    if (!document.getElementById('event-pole').value) showError('event-pole', 'Choisis un pôle responsable.');
  }
  if (eventForm.querySelector('.create-field-error.visible')) {
    focusFirstError(eventForm);
    return false;
  }
  return true;
}

function setVisibility(kind, mode) {
  visibilityState[kind] = mode;
  document.querySelectorAll(`[data-visibility-group="${kind}"] [data-visibility]`).forEach(button => {
    const active = button.dataset.visibility === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.getElementById(`${kind}-visibility-pole-wrap`).classList.toggle('hidden', mode !== 'pole');
  document.getElementById(`${kind}-visibility-members-wrap`).classList.toggle('hidden', mode !== 'membres');
}

function readVisibility(kind) {
  const mode = visibilityState[kind];
  if (mode === 'pole') {
    const pole = document.getElementById(`${kind}-visibility-pole`).value;
    return pole ? { visibilite: 'pole', cible: pole } : { error: 'Choisis un pôle destinataire.' };
  }
  if (mode === 'membres') {
    const ids = [...document.querySelectorAll(`#${kind}-visibility-members input:checked`)].map(input => input.value);
    return ids.length
      ? { visibilite: 'membres', cible: ids }
      : { error: 'Choisis au moins une personne.' };
  }
  if (mode === 'bureau') return { visibilite: 'bureau', cible: null };
  return { visibilite: 'tous', cible: null };
}

function renderEventRecap() {
  const type = EVENT_TYPES[selectedEventType];
  const visibility = visibilityState.event;
  const poleLabels = getPoleLabels();
  const visibilityLabel = visibility === 'bureau'
    ? 'Le bureau'
    : visibility === 'pole'
      ? poleLabels[document.getElementById('event-visibility-pole').value] || 'Un pôle'
      : visibility === 'membres'
        ? `${document.querySelectorAll('#event-visibility-members input:checked').length} membre(s)`
        : 'Tout le club';
  const autoCount = (AUTO_NEEDS[selectedEventType] || []).length;
  document.getElementById('event-recap').innerHTML = `
    <div class="create-recap-row"><span>Type</span><strong>${createEscape(type?.label || '—')}</strong></div>
    <div class="create-recap-row"><span>Nom</span><strong>${createEscape(document.getElementById('event-name').value.trim() || '—')}</strong></div>
    <div class="create-recap-row"><span>Quand</span><strong>${createEscape(dateForDisplay(document.getElementById('event-date').value))}${document.getElementById('event-time').value ? ` · ${createEscape(document.getElementById('event-time').value.replace(':', 'h'))}` : ''}</strong></div>
    <div class="create-recap-row"><span>Visible par</span><strong>${createEscape(visibilityLabel)}</strong></div>
    ${autoCount ? `<div class="create-recap-row"><span>Missions créées</span><strong>${autoCount} automatiquement</strong></div>` : ''}
  `;
}

async function sendNotification(type, data) {
  try {
    const { error } = await window.sb.functions.invoke('send-notification', {
      body: { type, data }
    });
    if (error) console.warn('Notification push non envoyée', error);
  } catch (error) {
    console.warn('Notification push non envoyée', error);
  }
}

async function refreshAfterCreation() {
  await window.AssopilotV3?.rechargerDonnees?.();
  window.mettreAJourCreationSelonDroits?.();
}

document.querySelectorAll('[data-create-kind]').forEach(button => {
  button.addEventListener('click', () => {
    const kind = button.dataset.createKind;
    const panelId = kind === 'need' ? 'need-form'
      : kind === 'event' ? 'event-form'
      : kind === 'announcement' ? 'announcement-form'
      : kind === 'member' ? 'member-form'
      : 'hub';
    setCreatePanel(panelId);
  });
});

document.querySelectorAll('[data-create-close]').forEach(button => button.addEventListener('click', closeCreation));
createButton.addEventListener('click', () => {
  if (createOverlay.classList.contains('hidden')) openCreation();
  else closeCreation();
});

createBack.addEventListener('click', () => {
  if (createPanel === 'need-form' && needStep > 1) showNeedStep(needStep - 1);
  else if (createPanel === 'event-form' && eventStep > 1) showEventStep(eventStep - 1);
  else setCreatePanel('hub');
});

document.querySelectorAll('[data-form-back]').forEach(button => {
  button.addEventListener('click', () => {
    const kind = button.dataset.formBack;
    if (kind === 'need') {
      if (needStep === 1) setCreatePanel('hub');
      else showNeedStep(needStep - 1);
    } else if (eventStep === 1) setCreatePanel('hub');
    else showEventStep(eventStep - 1);
  });
});

document.querySelector('[data-form-next="need"]').addEventListener('click', () => {
  if (validateNeedStep()) showNeedStep(needStep + 1);
});
document.querySelector('[data-form-next="event"]').addEventListener('click', () => {
  if (validateEventStep()) showEventStep(eventStep + 1);
});

document.querySelectorAll('[data-need-template]').forEach(button => {
  button.addEventListener('click', () => {
    const template = NEED_TEMPLATES[button.dataset.needTemplate];
    if (!template) return;
    document.getElementById('need-name').value = template.nom;
    document.getElementById('need-duration').value = template.duree;
    document.getElementById('need-count').value = template.cherche;
    if ([...document.getElementById('need-pole').options].some(option => option.value === template.pole)) {
      document.getElementById('need-pole').value = template.pole;
    }
    document.querySelectorAll('[data-need-template]').forEach(item => item.classList.toggle('selected', item === button));
  });
});

document.getElementById('need-event').addEventListener('change', event => {
  const attached = Boolean(event.target.value);
  document.getElementById('need-date-block').classList.toggle('hidden', attached);
  document.getElementById('need-event-date-note').classList.toggle('hidden', !attached);
});

document.querySelectorAll('[data-visibility-group]').forEach(group => {
  group.querySelectorAll('[data-visibility]').forEach(button => {
    button.addEventListener('click', () => {
      const kind = group.dataset.visibilityGroup;
      setVisibility(kind, button.dataset.visibility);
      if (kind === 'event' && eventStep === 4) renderEventRecap();
    });
  });
});

document.querySelectorAll('[data-event-type]').forEach(button => {
  button.addEventListener('click', () => {
    selectedEventType = button.dataset.eventType;
    const config = EVENT_TYPES[selectedEventType];
    document.querySelectorAll('[data-event-type]').forEach(item => item.classList.toggle('selected', item === button));
    const name = document.getElementById('event-name');
    if (!name.value.trim()) name.value = config.nom;
    setVisibility('event', config.visibilite);

    const autoNeeds = AUTO_NEEDS[selectedEventType] || [];
    const preview = document.getElementById('event-auto-needs');
    preview.classList.toggle('hidden', !autoNeeds.length);
    preview.innerHTML = autoNeeds.length
      ? `<strong>Missions ajoutées automatiquement</strong><ul>${autoNeeds.map(need =>
          `<li>${createEscape(need.nom)}${need.veille ? ' · la veille' : ''}</li>`
        ).join('')}</ul>`
      : '';
    clearErrors(eventForm);
  });
});

document.querySelectorAll('[data-date-shortcut]').forEach(button => {
  button.addEventListener('click', () => {
    const date = new Date();
    const shortcut = button.dataset.dateShortcut;
    if (shortcut === 'samedi' || shortcut === 'dimanche') {
      const target = shortcut === 'samedi' ? 6 : 0;
      let delta = (target - date.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      date.setDate(date.getDate() + delta);
    } else {
      date.setDate(date.getDate() + Number(shortcut));
    }
    document.getElementById('event-date').value = localISO(date);
    document.querySelectorAll('[data-date-shortcut]').forEach(item => item.classList.toggle('selected', item === button));
  });
});

needForm.addEventListener('submit', async event => {
  event.preventDefault();
  clearErrors(needForm);
  const visibility = readVisibility('need');
  if (visibility.error) {
    showError('need-visibility', visibility.error);
    return;
  }

  const name = document.getElementById('need-name').value.trim();
  const eventId = document.getElementById('need-event').value || null;
  const pole = document.getElementById('need-pole').value;
  const count = Number(document.getElementById('need-count').value);
  if (!name) showError('need-name', 'Donne un nom à ce besoin.');
  if (!Number.isInteger(count) || count < 1) showError('need-count', 'Indique au moins une personne.');
  if (!pole || !getManagedPoles().includes(pole)) showError('need-pole', 'Tu n’as pas les droits sur ce pôle.');
  if (needForm.querySelector('.create-field-error.visible')) {
    focusFirstError(needForm);
    return;
  }

  const linkedEvent = getClubData().evenements.find(item => String(item.id) === String(eventId));
  const line = {
    nom: name,
    pole,
    date_iso: linkedEvent?.date_iso || document.getElementById('need-date').value || null,
    duree: document.getElementById('need-duration').value.trim() || null,
    urgence_forcee: document.getElementById('need-urgency').value === 'auto'
      ? null
      : document.getElementById('need-urgency').value,
    precisions: document.getElementById('need-details').value.trim() || null,
    cherche: count,
    evenement_id: eventId,
    responsable_id: document.getElementById('need-manager').value || null,
    visibilite: visibility.visibilite,
    visibilite_cible: visibility.cible,
    groupe_id: document.getElementById('need-group').value || null
  };

  const submit = needForm.querySelector('button[type="submit"]');
  setButtonLoading(submit, true, 'Publication…');
  const { error } = await window.sb.from('besoins').insert(line);
  if (error) {
    console.error('Création besoin impossible', error);
    setButtonLoading(submit, false);
    montrerToast('Le besoin n’a pas pu être publié.');
    return;
  }

  await refreshAfterCreation();
  setButtonLoading(submit, false);
  closeCreation();
  montrerToast('Le besoin est publié.');

  const targetDate = line.date_iso ? new Date(`${line.date_iso}T12:00:00`) : null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffDays = targetDate ? Math.round((targetDate - today) / 86400000) : 99;
  const urgent = line.urgence_forcee === 'urgent'
    || (!line.urgence_forcee && diffDays <= 3);
  if (urgent) {
    const groupMembers = line.groupe_id
      ? getClubData().groupeMembres.get(String(line.groupe_id)) || []
      : [];
    sendNotification('besoin_urgent', {
      titre: 'Coup de main urgent',
      message: `${line.nom}${linkedEvent ? ` · ${linkedEvent.nom}` : ''} — ${diffDays <= 0 ? 'aujourd’hui' : `dans ${diffDays} j`}`,
      pole: line.pole,
      groupe_membres: groupMembers,
      url: 'https://assopilot-bay.vercel.app'
    });
  }
});

eventForm.addEventListener('submit', async event => {
  event.preventDefault();
  clearErrors(eventForm);
  const visibility = readVisibility('event');
  if (visibility.error) {
    showError('event-visibility', visibility.error);
    return;
  }
  if (!selectedEventType) showError('event-type', 'Choisis un type d’événement.');

  const name = document.getElementById('event-name').value.trim();
  const dateISO = document.getElementById('event-date').value;
  const pole = document.getElementById('event-pole').value;
  if (!name) showError('event-name', 'Donne un nom à l’événement.');
  if (!dateISO) showError('event-date', 'Choisis une date.');
  if (!pole || !getManagedPoles().includes(pole)) showError('event-pole', 'Tu n’as pas les droits sur ce pôle.');
  if (eventForm.querySelector('.create-field-error.visible')) {
    focusFirstError(eventForm);
    return;
  }

  const submit = eventForm.querySelector('button[type="submit"]');
  setButtonLoading(submit, true, 'Création…');
  const config = EVENT_TYPES[selectedEventType];
  const { data: createdEvent, error: eventError } = await window.sb
    .from('evenements')
    .insert({
      nom: name,
      type: selectedEventType,
      emoji: config.emoji,
      date_iso: dateISO,
      heure: document.getElementById('event-time').value || null,
      pole,
      visibilite: visibility.visibilite,
      visibilite_cible: visibility.cible,
      createur_id: window.appState.MON_ID || null
    })
    .select()
    .single();

  if (eventError) {
    console.error('Création événement impossible', eventError);
    setButtonLoading(submit, false);
    montrerToast('L’événement n’a pas pu être créé.');
    return;
  }

  const autoNeeds = AUTO_NEEDS[selectedEventType] || [];
  let autoNeedsError = null;
  if (autoNeeds.length) {
    const lines = autoNeeds.map(need => ({
      nom: need.nom,
      pole: need.pole,
      date_iso: need.veille ? minusOneDay(dateISO) : dateISO,
      duree: need.duree,
      cherche: need.cherche,
      urgence_forcee: null,
      precisions: need.precisions || '',
      evenement_id: createdEvent.id,
      visibilite: visibility.visibilite,
      visibilite_cible: visibility.cible
    }));
    const result = await window.sb.from('besoins').insert(lines);
    autoNeedsError = result.error;
    if (autoNeedsError) console.error('Création des missions automatiques impossible', autoNeedsError);
  }

  await refreshAfterCreation();
  setButtonLoading(submit, false);
  closeCreation();
  montrerToast(autoNeedsError
    ? 'Événement créé, mais les missions automatiques ont échoué.'
    : autoNeeds.length
      ? `Événement créé avec ${autoNeeds.length} missions.`
      : 'L’événement est créé.');

  if (selectedEventType === 'reunion') {
    sendNotification('reunion', {
      titre: 'Réunion planifiée',
      message: `${name} · ${dateForDisplay(dateISO)}${document.getElementById('event-time').value ? ` à ${document.getElementById('event-time').value.replace(':', 'h')}` : ''}`,
      url: 'https://assopilot-bay.vercel.app'
    });
  }
});

announcementForm.addEventListener('submit', async event => {
  event.preventDefault();
  clearErrors(announcementForm);
  const title = document.getElementById('announcement-title').value.trim();
  const copy = document.getElementById('announcement-copy').value.trim();
  const level = document.getElementById('announcement-level').value;
  if (!title) showError('announcement-title', 'Donne un titre à l’annonce.');
  if (!copy) showError('announcement-copy', 'Écris le message à publier.');
  if (announcementForm.querySelector('.create-field-error.visible')) {
    focusFirstError(announcementForm);
    return;
  }

  const submit = announcementForm.querySelector('button[type="submit"]');
  setButtonLoading(submit, true, 'Publication…');
  const { error } = await window.sb.from('annonces').insert({
    titre: title,
    texte: copy,
    niveau: level,
    active: true,
    auteur: window.appState.MOI
  });
  if (error) {
    console.error('Publication annonce impossible', error);
    setButtonLoading(submit, false);
    montrerToast('L’annonce n’a pas pu être publiée.');
    return;
  }

  await refreshAfterCreation();
  setButtonLoading(submit, false);
  closeCreation();
  montrerToast('L’annonce est publiée.');
  sendNotification('annonce_urgente', {
    titre: title,
    message: copy,
    url: 'https://assopilot-bay.vercel.app'
  });
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !createOverlay.classList.contains('hidden')) closeCreation();
});

window.mettreAJourCreationSelonDroits = function mettreAJourCreationSelonDroits() {
  const available = getManagedPoles().length > 0;
  createButton.classList.toggle('is-unavailable', !available);
  createButton.disabled = !available;
  createButton.setAttribute('aria-hidden', String(!available));
  if (available && !createOverlay.classList.contains('hidden')) populateCreationData();
};

window.initialiserCreation = function initialiserCreation() {
  window.mettreAJourCreationSelonDroits();
};
