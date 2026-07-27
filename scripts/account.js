/* ==========================================================================
   ASSOPILOT V3 — Mes aides et profil natifs
   ========================================================================== */

let installPromptV3 = null;

function accountEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function accountToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function accountDateLabel(iso) {
  if (!iso) return 'Date à confirmer';
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Date à confirmer';
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(date).replace('.', '');
}

function accountMissionIcon(name) {
  const text = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/salle|terrain/.test(text)) return 'shield-check';
  if (/table|chrono|score/.test(text)) return 'timer';
  if (/buvette|boisson/.test(text)) return 'cup-soda';
  if (/arbitr/.test(text)) return 'badge';
  if (/course|achat/.test(text)) return 'shopping-basket';
  if (/photo|reseau/.test(text)) return 'camera';
  if (/transport|voiture/.test(text)) return 'car-front';
  return 'hand-heart';
}

function accountData() {
  return window.AssopilotV3?.obtenirDonneesClub?.() || {
    besoins: [],
    inscriptions: [],
    evenementsTous: []
  };
}

function myAids() {
  const data = accountData();
  const myId = String(window.appState.MON_ID || '');
  const registeredIds = new Set(
    (data.inscriptions || [])
      .filter(row => String(row.membre_id) === myId)
      .map(row => String(row.besoin_id))
  );
  const eventMap = new Map((data.evenementsTous || data.evenements || []).map(event => [String(event.id), event]));
  const mine = (data.besoins || [])
    .filter(need => registeredIds.has(String(need.id)))
    .map(need => ({ ...need, event: eventMap.get(String(need.evenement_id || '')) || null }));
  const today = accountToday();
  return {
    upcoming: mine
      .filter(need => !need.date_iso || need.date_iso >= today)
      .sort((a, b) => String(a.date_iso || '9999').localeCompare(String(b.date_iso || '9999'))),
    completed: mine
      .filter(need => Boolean(need.date_iso) && need.date_iso < today)
      .sort((a, b) => String(b.date_iso).localeCompare(String(a.date_iso)))
  };
}

function aidMarkup(need, completed) {
  return `
    <article class="aid-card ${completed ? 'completed' : ''}">
      <span class="aid-card-icon" aria-hidden="true"><i data-lucide="${accountMissionIcon(need.nom)}"></i></span>
      <div class="aid-card-body">
        <h3>${accountEscape(need.nom)}</h3>
        ${need.event ? `<p class="aid-card-event">${accountEscape(need.event.nom)}</p>` : ''}
        <div class="aid-card-meta">
          <span><i data-lucide="calendar-days"></i>${accountEscape(accountDateLabel(need.date_iso))}</span>
          <span><i data-lucide="clock-3"></i>${accountEscape(need.duree || 'Durée à confirmer')}</span>
        </div>
      </div>
      <div class="aid-card-footer">
        <span class="aid-status"><i data-lucide="${completed ? 'badge-check' : 'circle-check'}"></i>${completed ? 'Mission réalisée' : 'Participation confirmée'}</span>
        ${completed || need.cloture ? '' : `<button class="aid-withdraw" data-aid-withdraw="${accountEscape(need.id)}">Me retirer</button>`}
      </div>
    </article>
  `;
}

function renderMyAids() {
  const { upcoming, completed } = myAids();
  const loading = document.getElementById('aids-loading');
  const empty = document.getElementById('aids-empty');
  const upcomingSection = document.getElementById('aids-upcoming-section');
  const completedSection = document.getElementById('aids-completed-section');
  const upcomingList = document.getElementById('aids-upcoming-list');
  const completedList = document.getElementById('aids-completed-list');

  document.getElementById('aids-upcoming-count').textContent = upcoming.length;
  document.getElementById('aids-completed-count').textContent = completed.length;
  loading.classList.add('hidden');
  empty.classList.toggle('hidden', upcoming.length + completed.length > 0);
  upcomingSection.classList.toggle('hidden', upcoming.length === 0);
  completedSection.classList.toggle('hidden', completed.length === 0);
  upcomingList.innerHTML = upcoming.map(need => aidMarkup(need, false)).join('');
  completedList.innerHTML = completed.map(need => aidMarkup(need, true)).join('');
  lucide.createIcons();
}

window.initialiserMesAides = async function initialiserMesAides() {
  const data = accountData();
  if (!data.besoins?.length && !data.inscriptions?.length) {
    document.getElementById('aids-loading').classList.remove('hidden');
    try {
      await window.AssopilotV3?.rechargerDonnees?.();
    } catch (error) {
      console.error('Chargement de mes aides impossible', error);
      document.getElementById('aids-loading').classList.add('hidden');
      montrerToast('Impossible de charger tes engagements.');
      return;
    }
  }
  renderMyAids();
};

window.rafraichirMesAides = renderMyAids;

document.getElementById('aids-view')?.addEventListener('click', event => {
  const button = event.target.closest('[data-aid-withdraw]');
  if (button) window.AssopilotV3?.ouvrirConfirmationMission?.(button.dataset.aidWithdraw);
});

function roleLabel(member) {
  if (member.fonction) return member.fonction;
  if (member.role === 'webmaster') return 'Webmaster';
  if (member.role === 'responsable') return 'Responsable de pôle';
  return 'Bénévole';
}

function renderRequests() {
  const panel = document.getElementById('profile-management-panel');
  const canManage = Boolean(window.AssopilotV3?.obtenirPolesGeres?.().length);
  panel.classList.toggle('hidden', !canManage);
  if (!canManage) return;

  const requests = (window.appState.comptesDemo || []).filter(member => member.statut === 'attente');
  const wrap = document.getElementById('profile-requests-wrap');
  const list = document.getElementById('profile-requests-list');
  document.getElementById('profile-requests-count').textContent = requests.length;
  wrap.classList.toggle('hidden', requests.length === 0);
  list.innerHTML = requests.map(member => `
    <article class="profile-request">
      <div>
        <strong>${accountEscape(`${member.prenom} ${member.nom || ''}`.trim())}</strong>
        <small>${accountEscape(member.identifiant)}</small>
      </div>
      <div class="profile-request-actions">
        <button data-request-id="${accountEscape(member.id)}" data-request-status="actif" aria-label="Accepter ${accountEscape(member.prenom)}"><i data-lucide="check"></i></button>
        <button data-request-id="${accountEscape(member.id)}" data-request-status="refuse" aria-label="Refuser ${accountEscape(member.prenom)}"><i data-lucide="x"></i></button>
      </div>
    </article>
  `).join('');
}

function updateInstallUI() {
  const button = document.getElementById('profile-install');
  const help = document.getElementById('install-help');
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (standalone) {
    button.textContent = 'Application déjà installée';
    button.disabled = true;
    help.textContent = 'AssoPilot est déjà disponible comme application sur cet appareil.';
  } else if (installPromptV3) {
    button.textContent = 'Installer AssoPilot';
    button.disabled = false;
    help.textContent = 'Ajoute AssoPilot à ton écran d’accueil en un geste.';
  } else if (isIOS) {
    button.textContent = 'Voir comment faire';
    button.disabled = false;
    help.textContent = 'Dans Safari : Partager, puis « Sur l’écran d’accueil ».';
  } else {
    button.textContent = 'Installation depuis le navigateur';
    button.disabled = false;
    help.textContent = 'Ouvre le menu du navigateur puis choisis « Installer l’application ».';
  }
}

function renderProfile() {
  const member = window.appState.currentMember || {};
  const name = `${member.prenom || ''} ${member.nom || ''}`.trim() || 'Membre du club';
  const initials = `${member.prenom?.[0] || ''}${member.nom?.[0] || ''}`.toUpperCase() || 'AP';
  const aids = myAids();

  document.getElementById('profile-avatar').textContent = initials;
  document.getElementById('profile-name').textContent = name;
  document.getElementById('profile-role').textContent = roleLabel(member);
  const functionBadge = document.getElementById('profile-function');
  const poleLabels = window.AssopilotV3?.obtenirLabelsPole?.() || {};
  functionBadge.textContent = member.pole ? (poleLabels[member.pole] || `Pôle ${member.pole}`) : '';
  functionBadge.classList.toggle('hidden', !member.pole);
  document.getElementById('profile-phone').value = member.tel || '';
  document.getElementById('profile-email').value = member.email || '';
  document.getElementById('profile-upcoming-count').textContent = aids.upcoming.length;
  document.getElementById('profile-completed-count').textContent = aids.completed.length;
  renderRequests();
  updateInstallUI();
  lucide.createIcons();
}

window.initialiserProfil = async function initialiserProfil() {
  if (!accountData().besoins?.length) {
    try {
      await window.AssopilotV3?.rechargerDonnees?.();
    } catch (error) {
      console.error('Chargement du profil impossible', error);
    }
  }
  renderProfile();
};

window.rafraichirProfil = renderProfile;

document.getElementById('profile-contact-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const phone = document.getElementById('profile-phone').value.trim();
  const email = document.getElementById('profile-email').value.trim();
  const errorBox = document.getElementById('profile-contact-error');
  const save = document.getElementById('profile-contact-save');
  errorBox.textContent = '';

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errorBox.textContent = 'Vérifie le format de ton adresse email.';
    document.getElementById('profile-email').focus();
    return;
  }
  if (phone && !/^[+\d][\d .()-]{7,19}$/.test(phone)) {
    errorBox.textContent = 'Vérifie le format de ton numéro de téléphone.';
    document.getElementById('profile-phone').focus();
    return;
  }

  save.disabled = true;
  save.textContent = 'Enregistrement…';
  const { error } = await window.sb.from('membres').update({ tel: phone, email }).eq('id', window.appState.MON_ID);
  save.disabled = false;
  save.textContent = 'Enregistrer';
  if (error) {
    console.error('Sauvegarde du profil impossible', error);
    errorBox.textContent = 'Impossible d’enregistrer pour le moment.';
    return;
  }

  const current = window.appState.currentMember;
  if (current) {
    current.tel = phone;
    current.email = email;
  }
  const cached = window.appState.comptesDemo.find(member => String(member.id) === String(window.appState.MON_ID));
  if (cached) {
    cached.tel = phone;
    cached.email = email;
  }
  montrerToast('Tes coordonnées sont enregistrées.');
});

document.getElementById('profile-management-panel')?.addEventListener('click', async event => {
  const managementAction = event.target.closest('[data-profile-action="announcement"]');
  if (managementAction) {
    window.ouvrirCreationV3?.('announcement');
    return;
  }

  const requestButton = event.target.closest('[data-request-id][data-request-status]');
  if (!requestButton) return;
  const memberId = requestButton.dataset.requestId;
  const status = requestButton.dataset.requestStatus;
  requestButton.disabled = true;
  const { error } = await window.sb.from('membres').update({ statut: status }).eq('id', memberId);
  if (error) {
    requestButton.disabled = false;
    montrerToast('Impossible de traiter cette demande.');
    return;
  }
  const member = window.appState.comptesDemo.find(item => String(item.id) === String(memberId));
  if (member) member.statut = status;
  renderRequests();
  lucide.createIcons();
  montrerToast(status === 'actif' ? 'Le membre est accepté.' : 'La demande est refusée.');
});

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPromptV3 = event;
  updateInstallUI();
});

window.addEventListener('appinstalled', () => {
  installPromptV3 = null;
  updateInstallUI();
  montrerToast('AssoPilot est installé !');
});

document.getElementById('profile-install')?.addEventListener('click', async () => {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (installPromptV3) {
    await installPromptV3.prompt();
    await installPromptV3.userChoice;
    installPromptV3 = null;
    updateInstallUI();
    return;
  }
  montrerToast(isIOS
    ? 'Dans Safari : Partager, puis « Sur l’écran d’accueil ».'
    : 'Dans le menu du navigateur, choisis « Installer l’application ».'
  );
});

document.getElementById('profile-logout')?.addEventListener('click', () => window.deconnecterAssopilot?.());

/* ==========================================================================
   ADMINISTRATION — membres et pôles (webmasters uniquement)
   ========================================================================== */

let filtreAdmin = 'tous';
let rechercheAdmin = '';

function estWebmaster() {
  return (window.appState.currentMember?.role || '') === 'webmaster';
}

function couleurAvatar(texte) {
  const palette = ['#16a34a','#2C6C90','#B84A32','#7A3F8C','#8A6A2E','#15663a','#a23226','#5b3f96'];
  let s = 0;
  for (let i = 0; i < texte.length; i++) s += texte.charCodeAt(i);
  return palette[s % palette.length];
}

function initialesAdmin(c) {
  return ((c.prenom || '?').charAt(0) + (c.nom || '').charAt(0)).toUpperCase();
}

function renderAdmin() {
  const panel = document.getElementById('admin-panel');
  if (!panel) return;
  panel.classList.toggle('hidden', !estWebmaster());
  if (!estWebmaster()) return;

  renderMembresList();
  renderPolesAdmin();
}

function renderMembresList() {
  const zone = document.getElementById('admin-membres-list');
  if (!zone) return;

  const veutInactifs = filtreAdmin === 'inactif';
  let liste = (window.appState.comptesDemo || []).filter(c =>
    veutInactifs ? c.statut === 'inactif' : c.statut === 'valide'
  );
  if (!veutInactifs && filtreAdmin !== 'tous') liste = liste.filter(c => c.role === filtreAdmin);
  if (rechercheAdmin) {
    const q = rechercheAdmin.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    liste = liste.filter(c => {
      const txt = `${c.prenom} ${c.nom || ''} ${c.identifiant}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return txt.includes(q);
    });
  }
  liste.sort((a, b) => (a.prenom || '').localeCompare(b.prenom || ''));

  const labels = { webmaster: 'Webmaster', responsable: 'Responsable', benevole: 'Bénévole' };
  const poleLabels = window.AssopilotV3?.obtenirLabelsPole?.() || {};

  if (!liste.length) {
    zone.innerHTML = `<p style="font-size:13px; color:#a8a091; text-align:center; padding:20px 0">${veutInactifs ? 'Aucun membre désactivé.' : 'Aucun résultat.'}</p>`;
    return;
  }

  zone.innerHTML = liste.map(c => {
    const inactif = c.statut === 'inactif';
    const poleNom = c.pole ? (poleLabels[c.pole] || c.pole) : '';
    const bureauBadge = c.bureau ? '<span class="admin-badge bureau">🏛️ Bureau</span>' : '';
    const roleBadge = c.role !== 'benevole' ? `<span class="admin-badge ${c.role}">${labels[c.role] || c.role}</span>` : '';

    if (inactif) return `
      <div class="admin-membre-carte estompe" id="admin-m-${c.identifiant}">
        <div class="admin-m-tete">
          <div class="admin-avatar" style="background:${couleurAvatar(c.prenom + (c.nom || ''))}">${initialesAdmin(c)}</div>
          <div class="admin-m-info">
            <div class="admin-m-nom">${accountEscape(c.prenom)} ${accountEscape(c.nom || '')}</div>
            <div class="admin-m-sous">${accountEscape(c.identifiant)}</div>
          </div>
          <span class="admin-badge inactif">Inactif</span>
          <button class="admin-m-btn" onclick="adminReactiver('${c.identifiant}')">↩️</button>
        </div>
      </div>`;

    return `
      <div class="admin-membre-carte" id="admin-m-${c.identifiant}">
        <div class="admin-m-tete">
          <div class="admin-avatar" style="background:${couleurAvatar(c.prenom + (c.nom || ''))}">${initialesAdmin(c)}</div>
          <div class="admin-m-info">
            <div class="admin-m-nom">${accountEscape(c.prenom)} ${accountEscape(c.nom || '')} ${bureauBadge} ${roleBadge}</div>
            <div class="admin-m-sous">${accountEscape(c.identifiant)}${poleNom ? ' · ' + accountEscape(poleNom) : ''}</div>
          </div>
          <button class="admin-m-btn" onclick="adminToggleEdition('${c.identifiant}')">✏️</button>
        </div>
        <div class="admin-m-edition hidden" id="admin-ed-${c.identifiant}">
          <label class="admin-m-label">Rôle
            <select onchange="adminChangerRole('${c.identifiant}', this.value)">
              <option value="benevole" ${c.role==='benevole'?'selected':''}>Bénévole</option>
              <option value="responsable" ${c.role==='responsable'?'selected':''}>Responsable</option>
              <option value="webmaster" ${c.role==='webmaster'?'selected':''}>Webmaster</option>
            </select>
          </label>
          <label class="admin-m-label" style="display:flex;align-items:center;gap:8px;margin-top:8px;">
            <input type="checkbox" ${c.bureau?'checked':''} onchange="adminChangerBureau('${c.identifiant}', this.checked)" style="width:17px;height:17px;accent-color:#1FA64F;" />
            <span>🏛️ Convié aux réunions de bureau</span>
          </label>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="admin-btn-danger" onclick="adminDesactiver('${c.identifiant}')">💤 Désactiver</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function adminToggleEdition(id) {
  const ed = document.getElementById('admin-ed-' + id);
  if (!ed) return;
  const ouvert = !ed.classList.contains('hidden');
  document.querySelectorAll('.admin-m-edition').forEach(e => e.classList.add('hidden'));
  if (!ouvert) ed.classList.remove('hidden');
}

async function adminChangerRole(id, role) {
  const c = (window.appState.comptesDemo || []).find(x => x.identifiant === id);
  if (!c) return;
  const { error } = await window.sb.from('membres').update({ role }).eq('identifiant', id);
  if (error) { montrerToast('Erreur, réessaie.'); return; }
  c.role = role;
  renderMembresList();
  montrerToast(`${c.prenom} est maintenant ${role}.`);
}

async function adminChangerBureau(id, valeur) {
  const c = (window.appState.comptesDemo || []).find(x => x.identifiant === id);
  if (!c) return;
  const { error } = await window.sb.from('membres').update({ bureau: valeur }).eq('identifiant', id);
  if (error) { montrerToast('Erreur, réessaie.'); return; }
  c.bureau = valeur;
  montrerToast(valeur ? `${c.prenom} est convié au bureau 🏛️` : `${c.prenom} n'est plus convié au bureau.`);
}

async function adminDesactiver(id) {
  const c = (window.appState.comptesDemo || []).find(x => x.identifiant === id);
  if (!c) return;
  if (c.id === window.appState.MON_ID) { montrerToast('Tu ne peux pas te désactiver toi-même.'); return; }
  const { error } = await window.sb.from('membres').update({ statut: 'inactif' }).eq('identifiant', id);
  if (error) { montrerToast('Erreur, réessaie.'); return; }
  c.statut = 'inactif';
  renderMembresList();
  montrerToast(`${c.prenom} est désactivé 💤`);
}

async function adminReactiver(id) {
  const c = (window.appState.comptesDemo || []).find(x => x.identifiant === id);
  if (!c) return;
  const { error } = await window.sb.from('membres').update({ statut: 'valide' }).eq('identifiant', id);
  if (error) { montrerToast('Erreur, réessaie.'); return; }
  c.statut = 'valide';
  renderMembresList();
  montrerToast(`${c.prenom} est réactivé ✅`);
}

function renderPolesAdmin() {
  const zone = document.getElementById('admin-poles-list');
  if (!zone) return;
  const data = window.AssopilotV3?.obtenirDonneesClub?.() || {};
  const poles = data.poles || [];
  const membres = (window.appState.comptesDemo || []).filter(c => c.statut === 'valide');
  const poleLabels = window.AssopilotV3?.obtenirLabelsPole?.() || {};

  if (!poles.length) {
    zone.innerHTML = `<p style="font-size:13px;color:#a8a091;text-align:center;padding:20px 0">Aucun pôle configuré.</p>`;
    return;
  }

  const opts = (selected) => `<option value="">— Personne —</option>` +
    membres.map(m => `<option value="${m.id}"${m.id===selected?' selected':''}>${accountEscape(m.prenom)} ${accountEscape(m.nom||'')}</option>`).join('');

  zone.innerHTML = poles.map(p => {
    const nomResp = p.responsable_id ? membres.find(m => m.id === p.responsable_id) : null;
    const nomAdj  = p.adjoint_id    ? membres.find(m => m.id === p.adjoint_id)    : null;
    return `
      <div class="admin-pole-carte" id="admin-pole-${p.code}">
        <div class="admin-m-tete">
          <div class="admin-m-info">
            <div class="admin-m-nom">${accountEscape(poleLabels[p.code] || p.code)}</div>
            <div class="admin-m-sous">
              ${nomResp ? `👤 ${accountEscape(nomResp.prenom)}` : '— aucun responsable'}
              ${nomAdj ? ` · 👥 ${accountEscape(nomAdj.prenom)}` : ''}
            </div>
          </div>
          <button class="admin-m-btn" onclick="adminTogglePole('${p.code}')">✏️</button>
        </div>
        <div class="admin-pole-edition hidden" id="admin-pole-ed-${p.code}">
          <label class="admin-m-label">Responsable
            <select onchange="adminAssignerPole('${p.code}','responsable_id',this.value)">${opts(p.responsable_id)}</select>
          </label>
          <label class="admin-m-label" style="margin-top:8px;">Adjoint
            <select onchange="adminAssignerPole('${p.code}','adjoint_id',this.value)">${opts(p.adjoint_id)}</select>
          </label>
        </div>
      </div>`;
  }).join('');
}

function adminTogglePole(code) {
  const ed = document.getElementById('admin-pole-ed-' + code);
  if (!ed) return;
  const ouvert = !ed.classList.contains('hidden');
  document.querySelectorAll('.admin-pole-edition').forEach(e => e.classList.add('hidden'));
  if (!ouvert) ed.classList.remove('hidden');
}

async function adminAssignerPole(code, champ, membreId) {
  const maj = { [champ]: membreId || null };
  const { error } = await window.sb.from('poles').update(maj).eq('code', code);
  if (error) { montrerToast('Erreur, réessaie.'); return; }
  // Mettre à jour le cache local
  const data = window.AssopilotV3?.obtenirDonneesClub?.() || {};
  const pole = (data.poles || []).find(p => p.code === code);
  if (pole) pole[champ] = membreId || null;
  renderPolesAdmin();
  montrerToast('Pôle mis à jour ✅');
}

// Recherche et filtres
document.getElementById('admin-recherche')?.addEventListener('input', e => {
  rechercheAdmin = e.target.value.trim();
  renderMembresList();
});

document.querySelectorAll('[data-admin-filtre]').forEach(btn =>
  btn.addEventListener('click', () => {
    filtreAdmin = btn.dataset.adminFiltre;
    document.querySelectorAll('[data-admin-filtre]').forEach(b =>
      b.classList.toggle('active', b === btn));
    renderMembresList();
  })
);

// Enrichir initialiserProfil pour afficher l'admin
const _initProfilOriginal = window.initialiserProfil;
window.initialiserProfil = async function() {
  await _initProfilOriginal?.();
  renderAdmin();
};

const _rafraichirProfilOriginal = window.rafraichirProfil;
window.rafraichirProfil = function() {
  _rafraichirProfilOriginal?.();
  renderAdmin();
};

function adminSwitchTab(vue) {
  document.getElementById('admin-view-membres').classList.toggle('hidden', vue !== 'membres');
  document.getElementById('admin-view-poles').classList.toggle('hidden', vue !== 'poles');
  document.querySelectorAll('.admin-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.adminView === vue));
  if (vue === 'poles') renderPolesAdmin();
}
