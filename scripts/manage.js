/* ==========================================================================
   ASSOPILOT V3 — Gestion des événements et besoins
   (suppression, modification) — webmasters et responsables de pôles
   ========================================================================== */

function peutGererEvenement(ev) {
  if (!ev) return false;
  const membre = window.appState.currentMember || {};
  const role = (membre.role || '').toLowerCase();
  if (role === 'webmaster') return true;
  const poles = window.AssopilotV3?.obtenirPolesGeres?.() || [];
  return ev.pole && poles.includes(ev.pole);
}

function peutGererBesoin(besoin) {
  if (!besoin) return false;
  const membre = window.appState.currentMember || {};
  const role = (membre.role || '').toLowerCase();
  if (role === 'webmaster') return true;
  const poles = window.AssopilotV3?.obtenirPolesGeres?.() || [];
  return besoin.pole && poles.includes(besoin.pole);
}

/* ── Suppression d'un événement (+ ses besoins + inscriptions) ── */
window.supprimerEvenement = async function(id) {
  const data = window.AssopilotV3?.obtenirDonneesClub?.() || {};
  const ev = (data.evenementsTous || data.evenements || []).find(e => String(e.id) === String(id));
  if (!ev || !peutGererEvenement(ev)) return;

  const nbBesoins = (data.besoins || []).filter(b => String(b.evenement_id) === String(id)).length;
  const texte = nbBesoins > 0
    ? `« ${ev.nom} » et ses ${nbBesoins} besoin(s) seront supprimés définitivement.`
    : `« ${ev.nom} » sera supprimé définitivement.`;

  ouvrirDialogConfirm({
    titre: 'Supprimer cet événement ?',
    texte,
    labelOk: 'Oui, supprimer',
    danger: true,
    onOk: async () => {
      const idsBesoins = (data.besoins || [])
        .filter(b => String(b.evenement_id) === String(id))
        .map(b => b.id);
      if (idsBesoins.length) {
        await window.sb.from('inscriptions').delete().in('besoin_id', idsBesoins);
        await window.sb.from('besoins').delete().eq('evenement_id', id);
      }
      const { error } = await window.sb.from('evenements').delete().eq('id', id);
      if (error) { montrerToast('Erreur lors de la suppression.'); return; }
      await window.AssopilotV3?.rechargerDonnees?.();
      montrerToast('Événement supprimé.');
    }
  });
};

/* ── Suppression d'un besoin ── */
window.supprimerBesoin = async function(id) {
  const data = window.AssopilotV3?.obtenirDonneesClub?.() || {};
  const besoin = (data.besoins || []).find(b => String(b.id) === String(id));
  if (!besoin || !peutGererBesoin(besoin)) return;

  ouvrirDialogConfirm({
    titre: 'Supprimer ce besoin ?',
    texte: `« ${besoin.nom} » sera retiré. Les bénévoles inscrits ne le verront plus.`,
    labelOk: 'Oui, supprimer',
    danger: true,
    onOk: async () => {
      await window.sb.from('inscriptions').delete().eq('besoin_id', id);
      const { error } = await window.sb.from('besoins').delete().eq('id', id);
      if (error) { montrerToast('Erreur lors de la suppression.'); return; }
      await window.AssopilotV3?.rechargerDonnees?.();
      montrerToast('Besoin supprimé.');
    }
  });
};

/* ── Clôturer / rouvrir un besoin ── */
window.cloturerBesoin = async function(id, cloture) {
  const { error } = await window.sb.from('besoins').update({ cloture }).eq('id', id);
  if (error) { montrerToast('Erreur, réessaie.'); return; }
  await window.AssopilotV3?.rechargerDonnees?.();
  montrerToast(cloture ? 'Besoin clôturé ✅' : 'Besoin rouvert 🔓');
};

/* ── Dialog de confirmation générique ── */
let _dialogCallback = null;

function ouvrirDialogConfirm({ titre, texte, labelOk, danger, onOk }) {
  let dialog = document.getElementById('manage-confirm-dialog');
  if (!dialog) {
    dialog = document.createElement('div');
    dialog.id = 'manage-confirm-dialog';
    dialog.className = 'manage-dialog-backdrop hidden';
    dialog.innerHTML = `
      <div class="manage-dialog">
        <p class="manage-dialog-title" id="mcd-title"></p>
        <p class="manage-dialog-text" id="mcd-text"></p>
        <div class="manage-dialog-actions">
          <button id="mcd-cancel" class="manage-dialog-btn">Annuler</button>
          <button id="mcd-ok" class="manage-dialog-btn primary">Confirmer</button>
        </div>
      </div>`;
    document.body.appendChild(dialog);
    document.getElementById('mcd-cancel').addEventListener('click', fermerDialogConfirm);
    document.getElementById('mcd-ok').addEventListener('click', async () => {
      fermerDialogConfirm();
      await _dialogCallback?.();
    });
    dialog.addEventListener('click', e => { if (e.target === dialog) fermerDialogConfirm(); });
  }

  document.getElementById('mcd-title').textContent = titre;
  document.getElementById('mcd-text').textContent = texte;
  const okBtn = document.getElementById('mcd-ok');
  okBtn.textContent = labelOk;
  okBtn.classList.toggle('danger', Boolean(danger));
  _dialogCallback = onOk;
  dialog.classList.remove('hidden');
  document.body.classList.add('dialog-open');
}

function fermerDialogConfirm() {
  document.getElementById('manage-confirm-dialog')?.classList.add('hidden');
  document.body.classList.remove('dialog-open');
  _dialogCallback = null;
}

/* ── Ajouter les boutons de gestion sur les cartes ── */
/* Patch de markupMission pour ajouter les boutons supprimer/clôturer */
const _markupOriginal = window.markupMissionOriginal;
window.ajouterBoutonsGestion = function(besoinId, pole) {
  const peutGerer = (window.appState.currentMember?.role === 'webmaster')
    || (window.AssopilotV3?.obtenirPolesGeres?.() || []).includes(pole);
  if (!peutGerer) return '';
  return `
    <div class="manage-actions">
      <button class="manage-btn" onclick="supprimerBesoin('${besoinId}')"><i data-lucide="trash-2"></i></button>
      <button class="manage-btn" onclick="cloturerBesoin('${besoinId}', true)"><i data-lucide="check-circle"></i></button>
    </div>`;
};

/* ── Injecter les boutons de suppression sur les cartes d'événement ── */
window.ajouterBoutonSupprEvenement = function(evId, pole) {
  const peutGerer = (window.appState.currentMember?.role === 'webmaster')
    || (window.AssopilotV3?.obtenirPolesGeres?.() || []).includes(pole);
  if (!peutGerer) return '';
  return `<button class="manage-btn event-delete" onclick="supprimerEvenement('${evId}')" title="Supprimer"><i data-lucide="trash-2"></i></button>`;
};

/* ── Création de compte membre ── */
document.getElementById('create-member-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const prenom = document.getElementById('member-prenom').value.trim();
  const nom = document.getElementById('member-nom').value.trim();
  const identifiant = document.getElementById('member-identifiant').value.trim().toLowerCase();
  const role = document.getElementById('member-role').value;
  const fonction = document.getElementById('member-fonction').value.trim();

  // Validations
  const errPr = document.querySelector('[data-error-for="member-prenom"]');
  const errId = document.querySelector('[data-error-for="member-identifiant"]');
  errPr.classList.remove('visible'); errId.classList.remove('visible');

  let ok = true;
  if (!prenom) { errPr.textContent = 'Le prénom est obligatoire.'; errPr.classList.add('visible'); ok = false; }
  if (!identifiant) { errId.textContent = 'L\'identifiant est obligatoire.'; errId.classList.add('visible'); ok = false; }
  else if (!/^[a-z0-9._-]{3,40}$/.test(identifiant)) { errId.textContent = 'Format invalide (lettres minuscules, chiffres, . _ -).'; errId.classList.add('visible'); ok = false; }
  if (!ok) return;

  // Vérifier si l'identifiant existe déjà
  const existant = (window.appState.comptesDemo || []).find(c => c.identifiant === identifiant);
  if (existant) { errId.textContent = 'Cet identifiant est déjà utilisé.'; errId.classList.add('visible'); return; }

  const submit = e.target.querySelector('button[type="submit"]');
  submit.disabled = true; submit.textContent = 'Création…';

  const { data, error } = await window.sb.from('membres').insert({
    prenom, nom: nom || null, identifiant, role, statut: 'valide',
    fonction: fonction || null, pin: null, bureau: false
  }).select().single();

  submit.disabled = false; submit.textContent = 'Créer le compte';

  if (error) {
    console.error('Création membre échouée', error);
    montrerToast('Impossible de créer ce compte.');
    return;
  }

  // Ajouter au cache local
  window.appState.comptesDemo.push({
    id: data.id, identifiant, prenom, nom: nom || '', role,
    statut: 'valide', pin: null, bureau: false, fonction: fonction || '',
    pole: null, tel: '', email: '', identifiantPerso: false
  });

  // Réinitialiser le formulaire
  e.target.reset();
  window.ouvrirCreationV3?.('hub');
  montrerToast(`${prenom} peut maintenant se connecter avec l'identifiant « ${identifiant} ».`);
});
