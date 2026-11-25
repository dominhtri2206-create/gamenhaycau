// Arcade Hub Portal Controller
(() => {
  'use strict';

  const Hub = window.ArcadeHub;
  const hubShopName = document.getElementById('hubShopName');
  const hubSoundIcon = document.getElementById('hubSoundIcon');
  const hubVoucherBadge = document.getElementById('hubVoucherBadge');
  const activeCharLabel = document.getElementById('activeCharLabel');
  const hubCharGrid = document.getElementById('hubCharGrid');
  const previewFlappyAvatar = document.getElementById('previewFlappyAvatar');
  const previewContraAvatar = document.getElementById('previewContraAvatar');
  const statFlappyBest = document.getElementById('statFlappyBest');
  const statContraBest = document.getElementById('statContraBest');
  const hubToast = document.getElementById('hubToast');

  const voucherModal = document.getElementById('hubVoucherModal');
  const settingsModal = document.getElementById('hubSettingsModal');

  let toastTimer = null;
  function showToast(msg) {
    hubToast.textContent = msg;
    hubToast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => hubToast.classList.add('hidden'), 2400);
  }

  function refreshHubUI() {
    const cfg = Hub.getShopConfig();
    const wallet = Hub.getWallet(false);
    const stats = Hub.getStatsSummary();
    const selectedChar = Hub.getSelectedCharacter(false);

    hubShopName.textContent = cfg.shopName;
    hubVoucherBadge.textContent = String(wallet.length);
    hubSoundIcon.textContent = window.soundFX.muted ? '🔇' : '🔊';

    activeCharLabel.textContent = `Đang chọn: ${selectedChar.name}`;
    previewFlappyAvatar.src = selectedChar.avatar;
    previewContraAvatar.src = selectedChar.avatar;

    statFlappyBest.textContent = `${stats.flappyBest} ống`;
    statContraBest.textContent =
      stats.contraStage > 0
        ? `${stats.contraBest} điểm • Stage ${stats.contraStage}`
        : `${stats.contraBest} điểm`;

    // Render character cards
    hubCharGrid.innerHTML = '';
    Hub.CHARACTERS.forEach((c) => {
      const isSel = c.id === selectedChar.id;
      const card = document.createElement('div');
      card.className = 'char-card' + (isSel ? ' selected' : '');
      card.innerHTML = `
        <div class="char-avatar-wrap" style="border: 2.5px solid ${c.primary}; box-shadow: 0 0 14px ${c.primary}66">
          <img src="${c.avatar}" alt="${c.name}" />
        </div>
        <div class="char-meta">
          <h4>${c.name}</h4>
          <p>${c.role}</p>
        </div>
        <span class="char-check">${isSel ? 'ĐANG CHỌN' : 'CHỌN'}</span>
      `;
      card.addEventListener('click', () => {
        Hub.setSelectedCharacterId(c.id, false);
        window.soundFX.click();
        refreshHubUI();
        showToast(`✨ Đã chọn nhân vật: ${c.name}`);
      });
      hubCharGrid.appendChild(card);
    });
  }

  function renderVoucherModal() {
    const cfg = Hub.getShopConfig();
    const wallet = Hub.getWallet(false);
    const stats = Hub.getStatsSummary();

    const tierList = document.getElementById('hubTierList');
    tierList.innerHTML = '';
    [...cfg.tiers]
      .sort((a, b) => a.score - b.score)
      .forEach((t) => {
        const unlocked = stats.bestUnits >= t.score || wallet.some((w) => w.tierScore === t.score);
        const row = document.createElement('div');
        row.className = 'hub-tier-row' + (unlocked ? ' unlocked' : '');
        row.innerHTML = `
          <span>${unlocked ? '✅' : '🔒'} <strong>${t.reward}</strong></span>
          <span style="color:var(--cyan);font-family:'Orbitron',sans-serif;font-size:0.78rem;font-weight:700">${t.score}Đ THƯỞNG</span>
        `;
        tierList.appendChild(row);
      });

    const walletList = document.getElementById('hubWalletList');
    walletList.innerHTML = '';
    if (wallet.length === 0) {
      walletList.innerHTML = `<p style="color:var(--muted);font-size:0.84rem;text-align:center;padding:12px 0">Chưa có Voucher nào. Hãy vào chơi Neon Flap hoặc Neon Contra để săn mã ưu đãi nhé!</p>`;
    } else {
      wallet.forEach((v) => {
        const row = document.createElement('div');
        row.className = 'hub-wallet-row';
        row.innerHTML = `
          <div>
            <div style="font-weight:700">${v.reward}</div>
            <div style="font-size:0.74rem;color:var(--muted)">${v.game || 'Neon Flap'} • Mốc ${v.tierScore}đ • ${v.date}</div>
          </div>
          <div class="hub-code-box">
            <code>${v.code}</code>
            <button class="hub-copy-btn" data-code="${v.code}">Copy</button>
          </div>
        `;
        walletList.appendChild(row);
      });

      walletList.querySelectorAll('.hub-copy-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (navigator.clipboard) navigator.clipboard.writeText(btn.dataset.code);
          btn.textContent = 'Đã chép!';
          window.soundFX.click();
          setTimeout(() => (btn.textContent = 'Copy'), 1400);
        });
      });
    }
  }

  function renderSettingsModal() {
    const cfg = Hub.getShopConfig();
    document.getElementById('hubInputShopName').value = cfg.shopName;
    document.getElementById('hubInputPrefix').value = cfg.codePrefix;
    const wrap = document.getElementById('hubTierInputs');
    wrap.innerHTML = '';
    cfg.tiers.forEach((t) => {
      const div = document.createElement('div');
      div.className = 'tier-in-grid';
      div.innerHTML = `
        <input type="number" min="1" max="999" value="${t.score}" class="hub-tier-score" required />
        <input type="text" maxlength="48" value="${t.reward}" class="hub-tier-reward" required />
      `;
      wrap.appendChild(div);
    });
  }

  document.getElementById('btnHubSound').addEventListener('click', () => {
    window.soundFX.toggleMute();
    refreshHubUI();
  });

  document.getElementById('btnHubWallet').addEventListener('click', () => {
    window.soundFX.click();
    renderVoucherModal();
    voucherModal.classList.add('active');
  });

  document.getElementById('btnHubSettings').addEventListener('click', () => {
    window.soundFX.click();
    renderSettingsModal();
    settingsModal.classList.add('active');
  });

  document.getElementById('hubSettingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const shopName = document.getElementById('hubInputShopName').value.trim() || Hub.DEFAULT_SHOP_CONFIG.shopName;
    const codePrefix = document.getElementById('hubInputPrefix').value.trim() || 'CF';
    const scores = document.querySelectorAll('.hub-tier-score');
    const rewards = document.querySelectorAll('.hub-tier-reward');
    const tiers = [];
    scores.forEach((inp, idx) => {
      tiers.push({
        score: Math.max(1, parseInt(inp.value, 10) || 10),
        reward: rewards[idx].value.trim() || 'Ưu đãi đặc biệt'
      });
    });
    Hub.saveShopConfig({ shopName, codePrefix, tiers });
    settingsModal.classList.remove('active');
    window.soundFX.reward();
    refreshHubUI();
    showToast('✅ Đã lưu cấu hình cho toàn bộ các game!');
  });

  document.getElementById('btnHubReset').addEventListener('click', () => {
    Hub.resetAllData();
    settingsModal.classList.remove('active');
    window.soundFX.click();
    refreshHubUI();
    showToast('🔄 Đã đặt lại toàn bộ kỷ lục và ví voucher.');
  });

  document.querySelectorAll('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.soundFX.click();
      document.getElementById(btn.dataset.close).classList.remove('active');
    });
  });

  [voucherModal, settingsModal].forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target === m) m.classList.remove('active');
    });
  });

  refreshHubUI();
})();
