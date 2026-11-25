// Shared Arcade Platform State: Characters, Cafe Voucher Wallet & Shop Config
(() => {
  'use strict';

  const CHARACTERS = [
    {
      id: 'char_1',
      name: 'Chiến Binh Cyber',
      role: 'Xạ Thủ Xanh Neon',
      desc: 'Hào quang Xanh Neon',
      avatar: 'assets/char1.png',
      primary: '#00f5d4',
      secondary: '#ff2a85',
      glow: '#00f5d4'
    },
    {
      id: 'char_2',
      name: 'Kỵ Sĩ Bóng Đêm',
      role: 'Đặc Nhiệm Plasma',
      desc: 'Hào quang Tím Plasma',
      avatar: 'assets/char2.png',
      primary: '#c084fc',
      secondary: '#38bdf8',
      glow: '#c084fc'
    },
    {
      id: 'char_3',
      name: 'Thủ Lĩnh Ánh Sáng',
      role: 'Chỉ Huy Vàng Kim',
      desc: 'Hào quang Vàng Kim',
      avatar: 'assets/char3.png',
      primary: '#fbbf24',
      secondary: '#fb7185',
      glow: '#fbbf24'
    }
  ];

  const DEFAULT_SHOP_CONFIG = {
    shopName: '✨ NEON CAFE ARCADE',
    codePrefix: 'CF',
    // score = điểm mốc chuẩn (Flappy: 1 ống = 1đ | Contra: 100 điểm chiến đấu = 1đ mốc)
    tiers: [
      { score: 10, reward: 'Giảm 10% tổng hóa đơn' },
      { score: 25, reward: 'Giảm 20% + Free Upsize' },
      { score: 50, reward: 'Tặng 1 bánh ngọt / Topping' },
      { score: 80, reward: 'Miễn phí 1 ly nước bất kỳ' }
    ]
  };

  const KEYS = {
    SKIN: 'neonflap_skin',
    WALLET: 'neonflap_voucher_wallet',
    DEMO_WALLET: 'neonflap_demo_voucher_wallet',
    SHOP_CONFIG: 'neonflap_shop_config',
    FLAPPY_BEST: 'neonflap_best_score',
    CONTRA_BEST: 'neoncontra_best_score',
    CONTRA_STAGE: 'neoncontra_best_stage'
  };

  const avatarCache = {};
  CHARACTERS.forEach((c) => {
    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.src = c.avatar;
      avatarCache[c.id] = img;
    }
  });

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function getSelectedCharacterId(isDemo = false) {
    const k = isDemo ? 'neonflap_demo_skin' : KEYS.SKIN;
    const saved = localStorage.getItem(k) || localStorage.getItem(KEYS.SKIN) || CHARACTERS[0].id;
    if (!CHARACTERS.some((c) => c.id === saved)) {
      localStorage.setItem(k, CHARACTERS[0].id);
      return CHARACTERS[0].id;
    }
    return saved;
  }

  function setSelectedCharacterId(id, isDemo = false) {
    if (!CHARACTERS.some((c) => c.id === id)) return;
    localStorage.setItem(isDemo ? 'neonflap_demo_skin' : KEYS.SKIN, id);
    if (!isDemo) {
      localStorage.setItem('neonflap_demo_skin', id);
    }
  }

  function getCharacterById(id) {
    return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
  }

  function getSelectedCharacter(isDemo = false) {
    return getCharacterById(getSelectedCharacterId(isDemo));
  }

  function getShopConfig() {
    const cfg = readJSON(KEYS.SHOP_CONFIG, null);
    if (!cfg || !Array.isArray(cfg.tiers)) {
      return JSON.parse(JSON.stringify(DEFAULT_SHOP_CONFIG));
    }
    return cfg;
  }

  function saveShopConfig(cfg) {
    localStorage.setItem(KEYS.SHOP_CONFIG, JSON.stringify(cfg));
  }

  function getWallet(isDemo = false) {
    return readJSON(isDemo ? KEYS.DEMO_WALLET : KEYS.WALLET, []);
  }

  function generateVoucherCode(prefix, tierScore) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 5; i++) {
      rand += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${(prefix || 'CF').toUpperCase()}${tierScore}-${rand}`;
  }

  // Try unlocking any tier <= milestoneUnits that hasn't been unlocked yet
  function checkAndUnlockVouchers(milestoneUnits, gameLabel = 'Neon Arcade', isDemo = false) {
    const cfg = getShopConfig();
    const walletKey = isDemo ? KEYS.DEMO_WALLET : KEYS.WALLET;
    const wallet = getWallet(isDemo);
    const sortedTiers = [...cfg.tiers].sort((a, b) => a.score - b.score);
    const newlyUnlocked = [];

    for (const tier of sortedTiers) {
      if (milestoneUnits >= tier.score) {
        const exists = wallet.some((v) => v.tierScore === tier.score && v.reward === tier.reward);
        if (!exists) {
          const item = {
            tierScore: tier.score,
            reward: tier.reward,
            code: generateVoucherCode(cfg.codePrefix, tier.score),
            game: gameLabel,
            date: new Date().toLocaleDateString('vi-VN')
          };
          wallet.unshift(item);
          newlyUnlocked.push(item);
        }
      }
    }

    if (newlyUnlocked.length > 0) {
      localStorage.setItem(walletKey, JSON.stringify(wallet));
    }
    return newlyUnlocked;
  }

  function getStatsSummary() {
    const flappyBest = parseInt(localStorage.getItem(KEYS.FLAPPY_BEST) || '0', 10) || 0;
    const contraBest = parseInt(localStorage.getItem(KEYS.CONTRA_BEST) || '0', 10) || 0;
    const contraStage = parseInt(localStorage.getItem(KEYS.CONTRA_STAGE) || '0', 10) || 0;
    const bestUnits = Math.max(flappyBest, Math.floor(contraBest / 100));
    return { flappyBest, contraBest, contraStage, bestUnits };
  }

  function resetAllData() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  }

  window.ArcadeHub = {
    CHARACTERS,
    DEFAULT_SHOP_CONFIG,
    KEYS,
    avatarCache,
    getSelectedCharacterId,
    setSelectedCharacterId,
    getCharacterById,
    getSelectedCharacter,
    getShopConfig,
    saveShopConfig,
    getWallet,
    checkAndUnlockVouchers,
    getStatsSummary,
    resetAllData
  };
})();
