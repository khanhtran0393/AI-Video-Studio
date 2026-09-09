/* AUTO-EXTRACTED from index.html block 3 - prefix: ref */

async function refreshTierFromCloud(){
  try {
    if (!window.currentUser || !window.firebaseLoadDoc) return;
    const data = await window.firebaseLoadDoc(window.currentUser.uid);
    state.userTier = (data && data.tier) || 'free';
    state.proUntil = (data && data.proUntil) || null;
    if ((state.userTier === 'pro' || state.userTier === 'max') && state.proUntil && Date.now() > state.proUntil) state.userTier = 'free';
    if (typeof renderTierBadge === 'function') renderTierBadge();
  } catch (e) {}
}

