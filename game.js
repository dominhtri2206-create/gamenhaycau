(() => {
  'use strict';

  // --- Constants & Default Config ---
  const DEMO_MODE = Boolean(window.NEONFLAP_AUTOPILOT);
  const KEY_PREFIX = DEMO_MODE ? 'neonflap_demo_' : 'neonflap_';
  const STORAGE_KEYS = {
    BEST_SCORE: KEY_PREFIX + 'best_score',
    SKIN: KEY_PREFIX + 'skin',
    THEME_MODE: KEY_PREFIX + 'theme_mode',
    WALLET: KEY_PREFIX + 'voucher_wallet',
    SHOP_CONFIG: 'neonflap_shop_config'
  };

  const SKINS = [
    {
      id: 'cyber_bird',
      name: 'Cyber Bird',
      desc: 'Chim Neon cổ điển',
      emoji: '🐦',
      primary: '#00f5d4',
      secondary: '#ff2a85',
      glow: '#00f5d4'
    },
    {
      id: 'neon_coffee',
      name: 'Neon Latte',
      desc: 'Ly cà phê bay lượn',
      emoji: '☕',
      primary: '#fbbf24',
      secondary: '#f97316',
      glow: '#fbbf24'
    },
    {
      id: 'plasma_orb',
      name: 'Plasma Drone',
      desc: 'Cầu năng lượng tím',
      emoji: '🔮',
      primary: '#a855f7',
      secondary: '#38bdf8',
      glow: '#c084fc'
    },
    {
      id: 'prism_wing',
      name: 'Crimson Jet',
      desc: 'Phi cơ ánh sáng đỏ',
      emoji: '🚀',
      primary: '#fb7185',
      secondary: '#fde047',
      glow: '#ff2a85'
    }
  ];

  const MEDALS = [
    { min: 100, key: 'platinum', name: 'Bạch Kim', emoji: '💎' },
    { min: 50, key: 'gold', name: 'Huy Chương Vàng', emoji: '🥇' },
    { min: 25, key: 'silver', name: 'Huy Chương Bạc', emoji: '🥈' },
    { min: 10, key: 'bronze', name: 'Huy Chương Đồng', emoji: '🥉' }
  ];

  const DEFAULT_SHOP_CONFIG = {
    shopName: '✨ NEON CAFE ARCADE',
    codePrefix: 'CF',
    tiers: [
      { score: 10, reward: 'Giảm 10% tổng hóa đơn' },
      { score: 25, reward: 'Giảm 20% + Free Upsize' },
      { score: 50, reward: 'Tặng 1 bánh ngọt / Topping' },
      { score: 80, reward: 'Miễn phí 1 ly nước bất kỳ' }
    ]
  };

  // --- Load Persistent State ---
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  let bestScore = parseInt(localStorage.getItem(STORAGE_KEYS.BEST_SCORE) || '0', 10) || 0;
  let currentSkinId = localStorage.getItem(STORAGE_KEYS.SKIN) || 'cyber_bird';
  let themeMode = localStorage.getItem(STORAGE_KEYS.THEME_MODE) || 'auto'; // 'night' | 'day' | 'auto'
  let wallet = loadJSON(STORAGE_KEYS.WALLET, []);
  let shopConfig = loadJSON(STORAGE_KEYS.SHOP_CONFIG, DEFAULT_SHOP_CONFIG);

  // --- DOM Elements ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const liveScoreWrap = document.getElementById('liveScoreWrap');
  const liveScoreEl = document.getElementById('liveScore');
  const difficultyBadge = document.getElementById('difficultyBadge');
  const soundIcon = document.getElementById('soundIcon');
  const themeIcon = document.getElementById('themeIcon');
  const voucherCountEl = document.getElementById('voucherCount');

  const menuScreen = document.getElementById('menuScreen');
  const readyOverlay = document.getElementById('readyOverlay');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const skinModal = document.getElementById('skinModal');
  const voucherModal = document.getElementById('voucherModal');
  const settingsModal = document.getElementById('settingsModal');

  const shopBrandTag = document.getElementById('shopBrandTag');
  const menuBestScore = document.getElementById('menuBestScore');
  const menuBestMedal = document.getElementById('menuBestMedal');

  const finalScoreEl = document.getElementById('finalScore');
  const bestScoreEl = document.getElementById('bestScore');
  const newBestBadge = document.getElementById('newBestBadge');
  const medalCircle = document.getElementById('medalCircle');
  const medalEmoji = document.getElementById('medalEmoji');
  const medalName = document.getElementById('medalName');

  const unlockedVoucherBox = document.getElementById('unlockedVoucherBox');
  const unlockedVoucherTitle = document.getElementById('unlockedVoucherTitle');
  const unlockedVoucherCode = document.getElementById('unlockedVoucherCode');
  const btnCopyNewVoucher = document.getElementById('btnCopyNewVoucher');
  const nextMilestoneHint = document.getElementById('nextMilestoneHint');

  const toast = document.getElementById('toast');
  const toastTitle = document.getElementById('toastTitle');
  const toastDesc = document.getElementById('toastDesc');

  // --- Game State & Physics Variables ---
  // States: 'MENU' | 'READY' | 'PLAYING' | 'GAMEOVER'
  let gameState = 'MENU';
  let viewWidth = window.innerWidth;
  let viewHeight = window.innerHeight;
  let groundHeight = 72;

  let score = 0;
  let difficultyLevel = 1;
  let dayBlend = themeMode === 'day' ? 1 : 0; // 0 = Night Neon, 1 = Day Clean Neon
  let targetDayBlend = dayBlend;

  let bird = {
    x: 0,
    y: 0,
    vy: 0,
    radius: 17,
    rotation: 0,
    wingPhase: 0
  };

  // Physics constants normalized to 60 FPS (dt = 1.0 at 16.667ms)
  const GRAVITY = 0.44;
  const FLAP_IMPULSE = -8.1;
  const MAX_FALL_SPEED = 11.5;

  let pipes = [];
  let pipeTimer = 0;
  let particles = [];
  let stars = [];
  let buildings = [];
  let groundOffset = 0;
  let screenShake = 0;
  let runUnlockedVoucher = null;
  let toastTimeout = null;

  // --- Responsive Canvas & Scenery Generation ---
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewWidth = window.innerWidth;
    viewHeight = window.innerHeight;
    canvas.width = Math.floor(viewWidth * dpr);
    canvas.height = Math.floor(viewHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    groundHeight = Math.max(60, Math.min(86, viewHeight * 0.1));
    bird.x = Math.min(viewWidth * 0.28, 180);
    if (gameState === 'MENU' || gameState === 'READY') {
      bird.y = (viewHeight - groundHeight) * 0.46;
    }
    initBackdrop();
  }

  function initBackdrop() {
    stars = [];
    const starCount = Math.floor((viewWidth * viewHeight) / 14000);
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * viewWidth,
        y: Math.random() * (viewHeight - groundHeight - 80),
        r: Math.random() * 1.7 + 0.5,
        twinkle: Math.random() * Math.PI * 2
      });
    }

    buildings = [];
    let bx = 0;
    while (bx < viewWidth + 140) {
      const bw = 38 + Math.random() * 52;
      const bh = 60 + Math.random() * 150;
      buildings.push({ x: bx, w: bw, h: bh });
      bx += bw + 6;
    }
  }

  // --- Theme & Color Interpolation ---
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpColor(hexA, hexB, t) {
    const a = parseInt(hexA.slice(1), 16);
    const b = parseInt(hexB.slice(1), 16);
    const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
    const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
    const bl = Math.round(lerp(a & 255, b & 255, t));
    return `rgb(${r}, ${g}, ${bl})`;
  }

  function updateThemeTarget() {
    if (themeMode === 'night') {
      targetDayBlend = 0;
      themeIcon.textContent = '🌙';
    } else if (themeMode === 'day') {
      targetDayBlend = 1;
      themeIcon.textContent = '☀️';
    } else {
      // Auto cycle every 15 points: 0-14 Night, 15-29 Day, 30-44 Night...
      const isDayPhase = Math.floor(score / 15) % 2 === 1;
      targetDayBlend = isDayPhase ? 1 : 0;
      themeIcon.textContent = '🌗';
    }
    document.body.setAttribute('data-theme', targetDayBlend > 0.5 ? 'day' : 'night');
  }

  // --- Difficulty Scaling ---
  function getDifficultyParams(pts) {
    const level = Math.min(8, Math.floor(pts / 10) + 1);
    const speed = Math.min(5.6, 3.0 + pts * 0.032);
    const gap = Math.max(132, 174 - pts * 0.45);
    const spawnInterval = Math.max(66, 98 - pts * 0.32); // frames at 60fps
    const movingChance = pts >= 20 ? Math.min(0.65, (pts - 15) * 0.015) : 0;
    return { level, speed, gap, spawnInterval, movingChance };
  }

  // --- Medals & Vouchers Logic ---
  function getMedalForScore(pts) {
    return MEDALS.find((m) => pts >= m.min) || null;
  }

  function generateVoucherCode(prefix, tierScore) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 5; i++) {
      rand += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${prefix.toUpperCase()}${tierScore}-${rand}`;
  }

  function checkVoucherMilestone(pts) {
    const sortedTiers = [...shopConfig.tiers].sort((a, b) => a.score - b.score);
    for (const tier of sortedTiers) {
      if (pts === tier.score) {
        const alreadyHas = wallet.some((v) => v.tierScore === tier.score && v.reward === tier.reward);
        if (!alreadyHas) {
          const newVoucher = {
            tierScore: tier.score,
            reward: tier.reward,
            code: generateVoucherCode(shopConfig.codePrefix || 'CF', tier.score),
            date: new Date().toLocaleDateString('vi-VN')
          };
          wallet.unshift(newVoucher);
          localStorage.setItem(STORAGE_KEYS.WALLET, JSON.stringify(wallet));
          runUnlockedVoucher = newVoucher;
          updateHUDMeta();
          showToast('🎁 Mở khóa Voucher!', `${tier.reward} (${newVoucher.code})`);
          window.soundFX.reward();
          return;
        } else {
          showToast('🔥 Đạt mốc điểm!', `Mốc ${tier.score} điểm — Tiếp tục phá kỷ lục!`);
          window.soundFX.reward();
        }
      }
    }
  }

  function showToast(title, desc) {
    toastTitle.textContent = title;
    toastDesc.textContent = desc;
    toast.classList.remove('hidden');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3200);
  }

  // --- Particles ---
  function spawnTrailParticle() {
    const skin = getSelectedSkin();
    particles.push({
      x: bird.x - 10,
      y: bird.y + (Math.random() - 0.5) * 10,
      vx: -1.8 - Math.random() * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      size: 3 + Math.random() * 3.5,
      alpha: 0.85,
      decay: 0.032,
      color: Math.random() > 0.35 ? skin.primary : skin.secondary
    });
  }

  function spawnBurst(x, y, colorA, colorB, count = 24) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const spd = 1.5 + Math.random() * 5.5;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 3 + Math.random() * 4.5,
        alpha: 1,
        decay: 0.022 + Math.random() * 0.015,
        color: i % 2 === 0 ? colorA : colorB
      });
    }
  }

  function getSelectedSkin() {
    return SKINS.find((s) => s.id === currentSkinId) || SKINS[0];
  }

  // --- Game Flow Transitions ---
  function enterReadyState() {
    gameState = 'READY';
    score = 0;
    difficultyLevel = 1;
    pipes = [];
    particles = [];
    pipeTimer = 0;
    runUnlockedVoucher = null;

    bird.x = Math.min(viewWidth * 0.28, 180);
    bird.y = (viewHeight - groundHeight) * 0.46;
    bird.vy = 0;
    bird.rotation = 0;

    updateThemeTarget();
    liveScoreEl.textContent = '0';
    difficultyBadge.textContent = 'LV.1';

    menuScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    readyOverlay.classList.remove('hidden');
    liveScoreWrap.classList.remove('hidden');
  }

  function flapAction() {
    if (gameState === 'READY') {
      gameState = 'PLAYING';
      readyOverlay.classList.add('hidden');
      pipeTimer = 65; // spawn first pipe quickly
    }
    if (gameState === 'PLAYING') {
      bird.vy = FLAP_IMPULSE;
      window.soundFX.flap();
      const skin = getSelectedSkin();
      spawnBurst(bird.x - 8, bird.y + 6, skin.primary, skin.secondary, 7);
    }
  }

  function triggerGameOver() {
    if (gameState === 'GAMEOVER') return;
    gameState = 'GAMEOVER';
    screenShake = 12;
    window.soundFX.crash();

    const skin = getSelectedSkin();
    spawnBurst(bird.x, bird.y, skin.primary, '#ff2a85', 30);

    let isNewBest = false;
    if (score > bestScore) {
      bestScore = score;
      isNewBest = true;
      localStorage.setItem(STORAGE_KEYS.BEST_SCORE, String(bestScore));
    }

    liveScoreWrap.classList.add('hidden');
    readyOverlay.classList.add('hidden');

    // Populate Game Over UI
    finalScoreEl.textContent = String(score);
    bestScoreEl.textContent = String(bestScore);
    newBestBadge.classList.toggle('hidden', !isNewBest);

    const medal = getMedalForScore(score);
    medalCircle.className = 'medal-circle ' + (medal ? medal.key : 'none');
    medalEmoji.textContent = medal ? medal.emoji : '—';
    medalName.textContent = medal ? medal.name : 'Chưa đạt (<10đ)';

    if (runUnlockedVoucher) {
      unlockedVoucherBox.classList.remove('hidden');
      unlockedVoucherTitle.textContent = runUnlockedVoucher.reward;
      unlockedVoucherCode.textContent = runUnlockedVoucher.code;
    } else {
      unlockedVoucherBox.classList.add('hidden');
    }

    // Next milestone hint
    const sortedTiers = [...shopConfig.tiers].sort((a, b) => a.score - b.score);
    const nextTier = sortedTiers.find((t) => t.score > score);
    if (nextTier) {
      nextMilestoneHint.innerHTML = `Chỉ còn <strong>${nextTier.score - score} điểm</strong> nữa để đạt mốc <strong>${nextTier.score}đ</strong> (${nextTier.reward})!`;
    } else {
      nextMilestoneHint.innerHTML = `🔥 Xuất sắc! Bạn đã chinh phục tất cả các mốc thưởng của quán!`;
    }

    updateHUDMeta();
    setTimeout(() => {
      if (gameState === 'GAMEOVER') {
        gameOverScreen.classList.add('active');
      }
    }, 360);
  }

  // --- Spawning & Updating Pipes ---
  function spawnPipe() {
    const params = getDifficultyParams(score);
    const playHeight = viewHeight - groundHeight;
    const minTop = 68;
    const maxTop = Math.max(minTop + 40, playHeight - params.gap - 78);

    let lo = minTop;
    let hi = maxTop;
    if (pipes.length > 0) {
      const prevTop = pipes[pipes.length - 1].baseTop;
      const maxDelta = 220;
      lo = Math.max(minTop, prevTop - maxDelta);
      hi = Math.min(maxTop, prevTop + maxDelta);
    }
    const topHeight = lo + Math.random() * Math.max(1, hi - lo);

    const isMoving = Math.random() < params.movingChance;
    pipes.push({
      x: viewWidth + 40,
      width: 62,
      topHeight,
      baseTop: topHeight,
      gap: params.gap,
      passed: false,
      isMoving,
      movePhase: Math.random() * Math.PI * 2,
      moveAmp: isMoving ? Math.min(34, (maxTop - minTop) * 0.25) : 0
    });
  }

  // --- Main Update Loop ---
  function update(dt, timeSec) {
    // Smooth day/night transition
    dayBlend += (targetDayBlend - dayBlend) * Math.min(1, 0.035 * dt);

    if (screenShake > 0) {
      screenShake = Math.max(0, screenShake - 0.8 * dt);
    }

    const params = getDifficultyParams(score);
    if (gameState === 'MENU' || gameState === 'READY') {
      groundOffset = (groundOffset + 1.8 * dt) % 48;
      bird.y = (viewHeight - groundHeight) * 0.46 + Math.sin(timeSec * 4.2) * 9;
      bird.wingPhase += 0.18 * dt;
      bird.rotation = Math.sin(timeSec * 2.5) * 0.08;
    } else if (gameState === 'PLAYING') {
      groundOffset = (groundOffset + params.speed * dt) % 48;
      bird.wingPhase += 0.28 * dt;

      // Bird physics
      bird.vy = Math.min(MAX_FALL_SPEED, bird.vy + GRAVITY * dt);
      bird.y += bird.vy * dt;

      // Smooth bird tilt
      const targetRot = bird.vy < 0 ? -0.42 : Math.min(Math.PI * 0.44, (bird.vy / MAX_FALL_SPEED) * 1.15);
      bird.rotation += (targetRot - bird.rotation) * Math.min(1, 0.22 * dt);

      if (Math.random() < 0.55 * dt) {
        spawnTrailParticle();
      }

      // Ceiling clamp & floor collision
      if (bird.y - bird.radius < 0) {
        bird.y = bird.radius;
        bird.vy = 0;
      }
      if (bird.y + bird.radius >= viewHeight - groundHeight) {
        bird.y = viewHeight - groundHeight - bird.radius;
        triggerGameOver();
        return;
      }

      // Pipe spawning
      pipeTimer += dt;
      if (pipeTimer >= params.spawnInterval) {
        pipeTimer = 0;
        spawnPipe();
      }

      // Update pipes & check collisions
      const hitRadius = bird.radius - 3; // slightly forgiving hitbox
      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= params.speed * dt;

        if (p.isMoving) {
          p.movePhase += 0.035 * dt;
          p.topHeight = p.baseTop + Math.sin(p.movePhase) * p.moveAmp;
        }

        // Score check
        if (!p.passed && p.x + p.width < bird.x) {
          p.passed = true;
          score += 1;
          liveScoreEl.textContent = String(score);

          const nextParams = getDifficultyParams(score);
          if (nextParams.level !== difficultyLevel) {
            difficultyLevel = nextParams.level;
            difficultyBadge.textContent = `LV.${difficultyLevel}`;
          }

          window.soundFX.score();
          updateThemeTarget();
          checkVoucherMilestone(score);
        }

        // Collision check (circle vs top & bottom pipe rectangles)
        if (bird.x + hitRadius > p.x && bird.x - hitRadius < p.x + p.width) {
          const inGap = bird.y - hitRadius > p.topHeight && bird.y + hitRadius < p.topHeight + p.gap;
          if (!inGap) {
            triggerGameOver();
            return;
          }
        }

        if (p.x + p.width < -60) {
          pipes.splice(i, 1);
        }
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.alpha -= pt.decay * dt;
      if (pt.alpha <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  // --- Rendering ---
  function drawBackground(timeSec) {
    const playH = viewHeight - groundHeight;
    const skyTop = lerpColor('#050714', '#dbeafe', dayBlend);
    const skyBot = lerpColor('#120c2b', '#f8fafc', dayBlend);

    const grad = ctx.createLinearGradient(0, 0, 0, playH);
    grad.addColorStop(0, skyTop);
    grad.addColorStop(1, skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewWidth, playH);

    // Synthwave Sun / Minimalist Halo Circle
    const orbX = viewWidth * 0.5;
    const orbY = playH * 0.62;
    const orbR = Math.min(viewWidth, playH) * 0.22;
    const sunGrad = ctx.createLinearGradient(orbX, orbY - orbR, orbX, orbY + orbR);
    if (dayBlend < 0.5) {
      sunGrad.addColorStop(0, 'rgba(255, 42, 133, 0.28)');
      sunGrad.addColorStop(1, 'rgba(139, 92, 246, 0.04)');
    } else {
      sunGrad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
      sunGrad.addColorStop(1, 'rgba(99, 102, 241, 0.04)');
    }
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(orbX, orbY, orbR, 0, Math.PI * 2);
    ctx.fill();

    // Stars (visible mostly at night)
    if (dayBlend < 0.85) {
      const starAlphaBase = (1 - dayBlend) * 0.75;
      for (const st of stars) {
        const tw = 0.55 + 0.45 * Math.sin(timeSec * 2.2 + st.twinkle);
        ctx.fillStyle = `rgba(226, 242, 255, ${starAlphaBase * tw})`;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Minimalist Skyline Silhouette
    const cityFill = lerpColor('#0b1024', '#cbd5e1', dayBlend);
    const cityStroke = dayBlend < 0.5 ? 'rgba(0, 245, 212, 0.16)' : 'rgba(2, 132, 199, 0.2)';
    ctx.fillStyle = cityFill;
    ctx.strokeStyle = cityStroke;
    ctx.lineWidth = 1;

    for (const b of buildings) {
      const by = playH - b.h;
      ctx.fillRect(b.x, by, b.w, b.h);
      ctx.strokeRect(b.x, by, b.w, b.h);
    }
  }

  function drawPipes() {
    const playH = viewHeight - groundHeight;
    const pipeBorder = dayBlend < 0.5 ? '#00f5d4' : '#0284c7';
    const movingBorder = dayBlend < 0.5 ? '#ff2a85' : '#e11d48';
    const pipeBody = dayBlend < 0.5 ? 'rgba(8, 22, 40, 0.86)' : 'rgba(224, 242, 254, 0.9)';

    for (const p of pipes) {
      const strokeCol = p.isMoving ? movingBorder : pipeBorder;
      const botY = p.topHeight + p.gap;
      const botH = Math.max(0, playH - botY);

      ctx.save();
      ctx.fillStyle = pipeBody;
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = strokeCol;
      ctx.shadowBlur = dayBlend < 0.5 ? 14 : 6;

      // Top pillar + lip
      ctx.fillRect(p.x, -2, p.width, p.topHeight + 2);
      ctx.strokeRect(p.x, -2, p.width, p.topHeight + 2);
      ctx.fillRect(p.x - 4, p.topHeight - 18, p.width + 8, 18);
      ctx.strokeRect(p.x - 4, p.topHeight - 18, p.width + 8, 18);

      // Bottom pillar + lip
      ctx.fillRect(p.x, botY, p.width, botH + 2);
      ctx.strokeRect(p.x, botY, p.width, botH + 2);
      ctx.fillRect(p.x - 4, botY, p.width + 8, 18);
      ctx.strokeRect(p.x - 4, botY, p.width + 8, 18);

      // Inner neon core stripe
      ctx.shadowBlur = 0;
      ctx.strokeStyle = p.isMoving ? 'rgba(255,42,133,0.35)' : 'rgba(0,245,212,0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + p.width * 0.25, 0);
      ctx.lineTo(p.x + p.width * 0.25, p.topHeight - 18);
      ctx.moveTo(p.x + p.width * 0.25, botY + 18);
      ctx.lineTo(p.x + p.width * 0.25, playH);
      ctx.stroke();

      ctx.restore();
    }
  }

  function drawGround() {
    const gy = viewHeight - groundHeight;
    const groundBg = lerpColor('#070b19', '#e2e8f0', dayBlend);
    const neonLine = dayBlend < 0.5 ? '#ff2a85' : '#0284c7';
    const gridCol = dayBlend < 0.5 ? 'rgba(255, 42, 133, 0.25)' : 'rgba(2, 132, 199, 0.22)';

    ctx.fillStyle = groundBg;
    ctx.fillRect(0, gy, viewWidth, groundHeight);

    // Perspective synthwave grid lines moving horizontally
    ctx.strokeStyle = gridCol;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = -groundOffset; x < viewWidth + 48; x += 48) {
      ctx.moveTo(x, gy);
      ctx.lineTo(x - 28, viewHeight);
    }
    ctx.moveTo(0, gy + groundHeight * 0.45);
    ctx.lineTo(viewWidth, gy + groundHeight * 0.45);
    ctx.stroke();

    // Glowing horizon line
    ctx.save();
    ctx.strokeStyle = neonLine;
    ctx.lineWidth = 3;
    ctx.shadowColor = neonLine;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(viewWidth, gy);
    ctx.stroke();
    ctx.restore();
  }

  function drawBird() {
    const skin = getSelectedSkin();
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);

    ctx.shadowColor = skin.glow;
    ctx.shadowBlur = dayBlend < 0.5 ? 18 : 10;

    const wingOffset = Math.sin(bird.wingPhase) * 5;

    if (skin.id === 'neon_coffee') {
      // Stylized Neon Coffee Cup with glowing wings
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = skin.primary;
      ctx.lineWidth = 2.6;

      // Cup body
      ctx.beginPath();
      ctx.moveTo(-13, -12);
      ctx.lineTo(13, -12);
      ctx.lineTo(10, 14);
      ctx.lineTo(-10, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Lid
      ctx.fillStyle = skin.secondary;
      ctx.fillRect(-15, -16, 30, 5);

      // Sleeve & Wing
      ctx.fillStyle = skin.primary;
      ctx.fillRect(-11, -3, 22, 8);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.quadraticCurveTo(-18, -8 + wingOffset, -14, 6 + wingOffset);
      ctx.stroke();
    } else if (skin.id === 'plasma_orb') {
      // Plasma Drone Orb + Orbit Ring
      ctx.fillStyle = skin.primary;
      ctx.beginPath();
      ctx.arc(0, 0, bird.radius - 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(4, -3, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = skin.secondary;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, bird.radius + 5, 6 + Math.abs(wingOffset) * 0.4, -0.35, 0, Math.PI * 2);
      ctx.stroke();
    } else if (skin.id === 'prism_wing') {
      // Sleek Crimson Neon Jet
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = skin.primary;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-15, -13);
      ctx.lineTo(-9, 0);
      ctx.lineTo(-15, 13);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Thruster flame
      ctx.fillStyle = skin.secondary;
      ctx.beginPath();
      ctx.moveTo(-11, -4);
      ctx.lineTo(-22 - Math.abs(wingOffset), 0);
      ctx.lineTo(-11, 4);
      ctx.closePath();
      ctx.fill();
    } else {
      // Default Cyber Bird
      ctx.fillStyle = '#0b132b';
      ctx.strokeStyle = skin.primary;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(0, 0, bird.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Neon Wing
      ctx.fillStyle = skin.secondary;
      ctx.beginPath();
      ctx.ellipse(-4, 2 + wingOffset * 0.6, 10, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(7, -5, 4.2, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(15, -3);
      ctx.lineTo(25, 2);
      ctx.lineTo(15, 6);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  function drawParticles() {
    for (const pt of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.alpha);
      ctx.fillStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function render(timeSec) {
    ctx.save();
    if (screenShake > 0) {
      const dx = (Math.random() - 0.5) * screenShake;
      const dy = (Math.random() - 0.5) * screenShake;
      ctx.translate(dx, dy);
    }

    drawBackground(timeSec);
    drawPipes();
    drawParticles();
    drawGround();
    drawBird();

    if (window.__neonFlapHooks && typeof window.__neonFlapHooks.onRender === 'function') {
      window.__neonFlapHooks.onRender(ctx, api.getState());
    }

    ctx.restore();
  }

  // --- External Controller / Auto-Pilot API ---
  let simSpeed = 1;
  let simTimeAccum = 0;

  const api = {
    getState() {
      return {
        gameState,
        score,
        bestScore,
        difficultyLevel,
        viewWidth,
        viewHeight,
        groundHeight,
        dayBlend,
        themeMode,
        currentSkinId,
        skins: SKINS,
        bird,
        pipes,
        params: getDifficultyParams(score),
        simSpeed
      };
    },
    startReady() {
      enterReadyState();
    },
    flap() {
      flapAction();
    },
    forceGameOver() {
      if (gameState === 'PLAYING' || gameState === 'READY') {
        gameState = 'PLAYING';
        triggerGameOver();
      }
    },
    setSimSpeed(mult) {
      simSpeed = Math.max(1, Math.min(16, Number(mult) || 1));
    },
    setSkin(skinId) {
      if (SKINS.some((s) => s.id === skinId)) {
        currentSkinId = skinId;
        localStorage.setItem(STORAGE_KEYS.SKIN, currentSkinId);
      }
    },
    showToast
  };
  window.__neonFlapAPI = api;

  // --- Main RAF Loop ---
  let lastTime = performance.now();
  function gameLoop(now) {
    const rawDt = (now - lastTime) / 16.6667;
    lastTime = now;
    const baseDt = Math.min(2.0, Math.max(0.1, rawDt));

    const steps = simSpeed > 1 ? Math.round(simSpeed) : 1;
    const stepDt = simSpeed > 1 ? 1.0 : baseDt;

    for (let s = 0; s < steps; s++) {
      simTimeAccum += (stepDt * 16.6667) * 0.001;
      if (window.__neonFlapHooks && typeof window.__neonFlapHooks.onBeforeStep === 'function') {
        window.__neonFlapHooks.onBeforeStep(api);
      }
      update(stepDt, simTimeAccum);
    }

    render(simTimeAccum);
    requestAnimationFrame(gameLoop);
  }

  // --- UI Helpers & Modals ---
  function updateHUDMeta() {
    shopBrandTag.textContent = shopConfig.shopName || DEFAULT_SHOP_CONFIG.shopName;
    menuBestScore.textContent = String(bestScore);
    const bestMedal = getMedalForScore(bestScore);
    menuBestMedal.textContent = bestMedal ? `${bestMedal.emoji} ${bestMedal.name.replace('Huy Chương ', '')}` : '—';
    voucherCountEl.textContent = String(wallet.length);
    soundIcon.textContent = window.soundFX.muted ? '🔇' : '🔊';
  }

  function renderSkinModal() {
    const grid = document.getElementById('skinGrid');
    grid.innerHTML = '';
    SKINS.forEach((s) => {
      const div = document.createElement('div');
      div.className = 'skin-item' + (s.id === currentSkinId ? ' selected' : '');
      div.innerHTML = `
        <div class="skin-preview" style="background: ${s.primary}22; border: 1px solid ${s.primary}">${s.emoji}</div>
        <div>
          <div class="skin-info-name">${s.name}</div>
          <div class="skin-info-desc">${s.desc}</div>
        </div>
      `;
      div.addEventListener('click', () => {
        currentSkinId = s.id;
        localStorage.setItem(STORAGE_KEYS.SKIN, currentSkinId);
        window.soundFX.click();
        renderSkinModal();
      });
      grid.appendChild(div);
    });

    document.querySelectorAll('#themeSelector .theme-opt').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === themeMode);
    });
  }

  function renderVoucherModal() {
    const tierList = document.getElementById('tierList');
    tierList.innerHTML = '';
    const sortedTiers = [...shopConfig.tiers].sort((a, b) => a.score - b.score);

    sortedTiers.forEach((t) => {
      const unlocked = bestScore >= t.score;
      const row = document.createElement('div');
      row.className = 'tier-row' + (unlocked ? ' unlocked' : '');
      row.innerHTML = `
        <div>
          <div class="tier-reward">${unlocked ? '✅ ' : '🔒 '}${t.reward}</div>
        </div>
        <div class="tier-pts">${t.score} ĐIỂM</div>
      `;
      tierList.appendChild(row);
    });

    const walletList = document.getElementById('walletList');
    walletList.innerHTML = '';
    if (wallet.length === 0) {
      walletList.innerHTML = `<div class="wallet-empty">Chưa có voucher nào. Hãy chơi và vượt qua các mốc điểm để nhận ưu đãi nhé!</div>`;
    } else {
      wallet.forEach((v) => {
        const card = document.createElement('div');
        card.className = 'wallet-card';
        card.innerHTML = `
          <div>
            <div class="tier-reward">${v.reward}</div>
            <div class="skin-info-desc">Mốc ${v.tierScore}đ • Ngày ${v.date}</div>
          </div>
          <div class="voucher-code-row">
            <code>${v.code}</code>
            <button class="copy-btn" data-code="${v.code}">Copy</button>
          </div>
        `;
        walletList.appendChild(card);
      });

      walletList.querySelectorAll('.copy-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          copyText(btn.dataset.code, btn);
        });
      });
    }
  }

  function renderSettingsModal() {
    document.getElementById('inputShopName').value = shopConfig.shopName;
    document.getElementById('inputCodePrefix').value = shopConfig.codePrefix;
    const wrap = document.getElementById('tierSettingsInputs');
    wrap.innerHTML = '';
    shopConfig.tiers.forEach((t, idx) => {
      const row = document.createElement('div');
      row.className = 'tier-input-row';
      row.innerHTML = `
        <input type="number" min="1" max="999" value="${t.score}" data-idx="${idx}" class="tier-score-in" required />
        <input type="text" maxlength="48" value="${t.reward}" data-idx="${idx}" class="tier-reward-in" required />
      `;
      wrap.appendChild(row);
    });
  }

  function copyText(text, btnEl) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    }
    const prev = btnEl.textContent;
    btnEl.textContent = 'Đã chép!';
    window.soundFX.click();
    setTimeout(() => {
      btnEl.textContent = prev;
    }, 1500);
  }

  function isAnyModalOpen() {
    return (
      skinModal.classList.contains('active') ||
      voucherModal.classList.contains('active') ||
      settingsModal.classList.contains('active')
    );
  }

  // --- Event Listeners ---
  window.addEventListener('resize', resizeCanvas);

  // Canvas Touch & Mouse Controls
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (isAnyModalOpen()) return;
    if (gameState === 'READY' || gameState === 'PLAYING') {
      flapAction();
    }
  });

  // Keyboard Controls
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (isAnyModalOpen()) return;
      if (gameState === 'MENU') {
        window.soundFX.click();
        enterReadyState();
      } else if (gameState === 'READY' || gameState === 'PLAYING') {
        flapAction();
      } else if (gameState === 'GAMEOVER' && gameOverScreen.classList.contains('active')) {
        window.soundFX.click();
        enterReadyState();
      }
    }
  });

  // Buttons
  document.getElementById('btnStart').addEventListener('click', () => {
    window.soundFX.click();
    enterReadyState();
  });

  document.getElementById('btnRestart').addEventListener('click', () => {
    window.soundFX.click();
    enterReadyState();
  });

  document.getElementById('btnGameOverMenu').addEventListener('click', () => {
    window.soundFX.click();
    gameState = 'MENU';
    pipes = [];
    gameOverScreen.classList.remove('active');
    menuScreen.classList.add('active');
  });

  document.getElementById('btnSound').addEventListener('click', () => {
    const muted = window.soundFX.toggleMute();
    soundIcon.textContent = muted ? '🔇' : '🔊';
  });

  document.getElementById('btnThemeQuick').addEventListener('click', () => {
    const order = ['night', 'day', 'auto'];
    themeMode = order[(order.indexOf(themeMode) + 1) % order.length];
    localStorage.setItem(STORAGE_KEYS.THEME_MODE, themeMode);
    window.soundFX.click();
    updateThemeTarget();
    const labelMap = { night: 'Chế độ Đêm Neon', day: 'Chế độ Ngày Tối Giản', auto: 'Tự động đổi Ngày/Đêm' };
    showToast('🌗 Đổi giao diện', labelMap[themeMode]);
  });

  document.getElementById('btnOpenSkins').addEventListener('click', () => {
    window.soundFX.click();
    renderSkinModal();
    skinModal.classList.add('active');
  });

  document.querySelectorAll('#themeSelector .theme-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      themeMode = btn.dataset.mode;
      localStorage.setItem(STORAGE_KEYS.THEME_MODE, themeMode);
      window.soundFX.click();
      updateThemeTarget();
      renderSkinModal();
    });
  });

  function openWalletModal() {
    window.soundFX.click();
    renderVoucherModal();
    voucherModal.classList.add('active');
  }

  document.getElementById('btnWallet').addEventListener('click', openWalletModal);
  document.getElementById('btnOpenVouchers').addEventListener('click', openWalletModal);
  document.getElementById('btnGameOverWallet').addEventListener('click', openWalletModal);

  btnCopyNewVoucher.addEventListener('click', () => {
    if (runUnlockedVoucher) {
      copyText(runUnlockedVoucher.code, btnCopyNewVoucher);
    }
  });

  document.getElementById('btnOpenSettings').addEventListener('click', () => {
    window.soundFX.click();
    renderSettingsModal();
    settingsModal.classList.add('active');
  });

  document.getElementById('settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const shopName = document.getElementById('inputShopName').value.trim() || DEFAULT_SHOP_CONFIG.shopName;
    const codePrefix = document.getElementById('inputCodePrefix').value.trim() || 'CF';
    const scoreInputs = document.querySelectorAll('.tier-score-in');
    const rewardInputs = document.querySelectorAll('.tier-reward-in');

    const newTiers = [];
    scoreInputs.forEach((inp, i) => {
      newTiers.push({
        score: Math.max(1, parseInt(inp.value, 10) || 10),
        reward: rewardInputs[i].value.trim() || 'Ưu đãi đặc biệt'
      });
    });

    shopConfig = { shopName, codePrefix, tiers: newTiers };
    localStorage.setItem(STORAGE_KEYS.SHOP_CONFIG, JSON.stringify(shopConfig));
    updateHUDMeta();
    settingsModal.classList.remove('active');
    window.soundFX.reward();
    showToast('✅ Đã lưu cấu hình', 'Mốc thưởng mới đã sẵn sàng!');
  });

  document.getElementById('btnResetData').addEventListener('click', () => {
    bestScore = 0;
    wallet = [];
    shopConfig = JSON.parse(JSON.stringify(DEFAULT_SHOP_CONFIG));
    localStorage.removeItem(STORAGE_KEYS.BEST_SCORE);
    localStorage.removeItem(STORAGE_KEYS.WALLET);
    localStorage.removeItem(STORAGE_KEYS.SHOP_CONFIG);
    updateHUDMeta();
    settingsModal.classList.remove('active');
    window.soundFX.click();
    showToast('🔄 Đã đặt lại', 'Kỷ lục và ví voucher đã được xóa mới.');
  });

  document.querySelectorAll('.close-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.soundFX.click();
      const targetId = btn.dataset.close;
      document.getElementById(targetId).classList.remove('active');
    });
  });

  // Close modal when clicking outside card
  [skinModal, voucherModal, settingsModal].forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // --- Boot ---
  resizeCanvas();
  updateThemeTarget();
  dayBlend = targetDayBlend;
  updateHUDMeta();
  requestAnimationFrame(gameLoop);
})();
