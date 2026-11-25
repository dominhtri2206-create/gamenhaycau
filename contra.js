// NEON CONTRA — 8-Directional Run & Gun Engine + Boss Fortress + Touch Controls + AI Auto-Pilot
(() => {
  'use strict';

  const Hub = window.ArcadeHub;
  const urlParams = new URLSearchParams(window.location.search);
  let isDemoAI = urlParams.get('autoplay') === '1';

  if (isDemoAI) {
    localStorage.removeItem(Hub.KEYS.DEMO_WALLET);
  }

  const canvas = document.getElementById('contraCanvas');
  const ctx = canvas.getContext('2d');

  // HUD & Overlays
  const hudLives = document.getElementById('hudLives');
  const hudWeapon = document.getElementById('hudWeapon');
  const hudStage = document.getElementById('hudStage');
  const hudScore = document.getElementById('hudScore');
  const contraSoundIcon = document.getElementById('contraSoundIcon');
  const contraVoucherCount = document.getElementById('contraVoucherCount');

  const bossHud = document.getElementById('bossHud');
  const bossTitle = document.getElementById('bossTitle');
  const bossBarFill = document.getElementById('bossBarFill');

  const stageBanner = document.getElementById('stageBanner');
  const stageBannerTitle = document.getElementById('stageBannerTitle');
  const stageBannerSub = document.getElementById('stageBannerSub');

  const startOverlay = document.getElementById('contraStartOverlay');
  const overOverlay = document.getElementById('contraOverOverlay');
  const charModal = document.getElementById('contraCharModal');
  const walletModal = document.getElementById('contraWalletModal');

  const cAiDot = document.getElementById('cAiDot');
  const cAiLabel = document.getElementById('cAiLabel');
  const btnToggleContraAI = document.getElementById('btnToggleContraAI');
  const btnContraEndNow = document.getElementById('btnContraEndNow');
  const touchControls = document.getElementById('touchControls');

  // Viewport & World Dimensions
  let viewW = window.innerWidth;
  let viewH = window.innerHeight;
  let groundY = 500;

  // Game State: 'START' | 'PLAYING' | 'STAGE_CLEAR' | 'GAMEOVER'
  let gameState = 'START';
  let aiEnabled = isDemoAI;
  let simSpeed = 1;
  let simClock = 0;

  let score = 0;
  let stage = 1;
  let cameraX = 0;
  let stageLength = 2500;
  let bossLocked = false;
  let screenShake = 0;
  let stageClearTimer = 0;
  let lastRunVoucher = null;
  let currentCharId = Hub.getSelectedCharacterId(isDemoAI);

  const WEAPONS = {
    M: { name: 'M • RIFLE', cooldown: 8, speed: 12.5, dmg: 1.25, color: '#00f5d4' },
    S: { name: 'S • SPREAD 5X', cooldown: 11, speed: 11.8, dmg: 1.15, color: '#ff2a85' },
    L: { name: 'L • LASER', cooldown: 13, speed: 15.5, dmg: 2.8, color: '#38bdf8' },
    F: { name: 'F • FIREBALL', cooldown: 14, speed: 10.2, dmg: 2.5, color: '#fbbf24' }
  };

  const player = {
    x: 120,
    y: 300,
    vx: 0,
    vy: 0,
    w: 28,
    h: 54,
    facing: 1, // 1 right, -1 left
    aimX: 1,
    aimY: 0,
    onGround: false,
    crouching: false,
    somersaultAngle: 0,
    runPhase: 0,
    lives: 3,
    weapon: 'M',
    fireTimer: 0,
    invulnTimer: 0,
    dropThroughTimer: 0,
    recentPlatformTimer: 0,
    recentPlatformY: 0
  };

  const input = {
    left: false,
    right: false,
    up: false,
    down: false,
    dropMod: false,
    dropPressed: false,
    jump: false,
    jumpPressed: false,
    fire: false,
    mouseFiring: false,
    mouseX: 0,
    mouseY: 0
  };

  const touchState = {
    joyX: 0,
    joyY: 0,
    fire: false,
    jump: false
  };

  let groundSegments = [];
  let platforms = [];
  let enemies = [];
  let capsules = [];
  let powerups = [];
  let bullets = [];
  let enemyBullets = [];
  let particles = [];
  let boss = null;
  let spawnWaveTimer = 0;
  let capsuleSpawnTimer = 180;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vp = window.MobileLandscape
      ? window.MobileLandscape.getViewport()
      : { width: window.innerWidth, height: window.innerHeight };
    const oldGroundY = groundY;
    viewW = vp.width;
    viewH = vp.height;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groundY = viewH <= 480 ? Math.max(270, viewH - 48) : Math.max(330, viewH - 110);

    // Shift world entities smoothly if screen orientation changed mid-game!
    if (oldGroundY && oldGroundY !== groundY && groundSegments.length > 0) {
      const dy = groundY - oldGroundY;
      player.y += dy;
      platforms.forEach((pf) => (pf.y += dy));
      enemies.forEach((en) => {
        en.y += dy;
        if (en.baseY) en.baseY += dy;
      });
      capsules.forEach((c) => {
        c.y += dy;
        c.baseY += dy;
      });
      powerups.forEach((pw) => (pw.y += dy));
      if (boss) {
        boss.core.y += dy;
        boss.turrets.forEach((t) => (t.y += dy));
      }
    }
  }

  // --- Stage Generation ---
  function buildStage(stageNum) {
    stage = stageNum;
    stageLength = 2400 + (stageNum - 1) * 420;
    cameraX = 0;
    bossLocked = false;
    groundSegments = [];
    platforms = [];
    enemies = [];
    capsules = [];
    powerups = [];
    bullets = [];
    enemyBullets = [];
    particles = [];
    spawnWaveTimer = 90;
    capsuleSpawnTimer = 110;

    // Starting safe ground
    let cursor = -100;
    groundSegments.push({ x1: -100, x2: 520 });
    cursor = 520;

    // Generate Cyber-Jungle segments with pits & multi-tier platforms
    while (cursor < stageLength - 520) {
      const pitW = 92 + Math.random() * 34;
      // Bridge platform above pit 65% of the time
      if (Math.random() < 0.65) {
        platforms.push({
          x: cursor - 15,
          y: groundY - 84,
          w: pitW + 30
        });
      }
      cursor += pitW;

      const segLen = 320 + Math.random() * 260;
      groundSegments.push({ x1: cursor, x2: cursor + segLen });

      // Add tier-1 and tier-2 tactical platforms
      const p1W = 130 + Math.random() * 90;
      const p1X = cursor + 35 + Math.random() * 60;
      platforms.push({ x: p1X, y: groundY - 90, w: p1W });

      if (Math.random() < 0.65) {
        platforms.push({
          x: p1X + 40,
          y: groundY - 174,
          w: 120
        });
      }

      // Place Snipers & Armored Turrets along segment
      enemies.push({
        type: 'sniper',
        x: p1X + p1W * 0.55,
        y: groundY - 90 - 26,
        vx: 0,
        vy: 0,
        w: 26,
        h: 48,
        hp: 2 + Math.floor(stageNum * 0.5),
        maxHp: 2 + Math.floor(stageNum * 0.5),
        shootTimer: 50 + Math.random() * 50
      });

      enemies.push({
        type: 'turret',
        x: cursor + segLen - 75,
        y: groundY - 22,
        w: 38,
        h: 38,
        hp: 5 + stageNum,
        maxHp: 5 + stageNum,
        angle: Math.PI,
        shootTimer: 65 + Math.random() * 45
      });

      // Pre-place flying weapon capsule triggers
      if (Math.random() < 0.75) {
        const types = ['S', 'L', 'F', 'S', '♥'];
        capsules.push({
          triggerX: cursor + 80,
          spawned: false,
          x: 0,
          y: groundY - 195,
          baseY: groundY - 195,
          phase: 0,
          item: types[Math.floor(Math.random() * types.length)]
        });
      }

      cursor += segLen;
    }

    // Boss Arena flat ground + 2 tactical combat platforms
    groundSegments.push({ x1: cursor, x2: stageLength + 600 });
    platforms.push({ x: stageLength - 380, y: groundY - 92, w: 125 });
    platforms.push({ x: stageLength - 240, y: groundY - 175, w: 115 });

    // Create End-of-Stage Cyber Fortress Boss Wall (Original Tough HP)
    const coreHp = 60 + (stageNum - 1) * 25;
    const gunHp = 20 + (stageNum - 1) * 8;
    boss = {
      x: stageLength + 30,
      w: 150,
      active: false,
      defeated: false,
      core: {
        x: stageLength + 46,
        y: groundY - 105,
        r: 30,
        hp: coreHp,
        maxHp: coreHp,
        flash: 0,
        shootTimer: 75
      },
      turrets: [
        {
          x: stageLength + 38,
          y: groundY - 225,
          hp: gunHp,
          maxHp: gunHp,
          shootTimer: 55,
          kind: 'laser'
        },
        {
          x: stageLength + 38,
          y: groundY - 165,
          hp: gunHp,
          maxHp: gunHp,
          shootTimer: 82,
          kind: 'mortar'
        }
      ]
    };

    // Place player at stage start
    player.x = 120;
    player.y = groundY - player.h * 0.5;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.invulnTimer = 90;

    hudStage.textContent = `STAGE ${stage}`;
    bossHud.classList.add('hidden');
    announceStage(`STAGE ${stage}`, stage === 1 ? 'CHIẾN DỊCH RỪNG ĐÊM NEON' : `PHÁO ĐÀI CẤP ĐỘ ${stage}`);
  }

  function announceStage(title, sub) {
    stageBannerTitle.textContent = title;
    stageBannerSub.textContent = sub;
    stageBanner.classList.remove('hidden');
    setTimeout(() => stageBanner.classList.add('hidden'), 2100);
  }

  // --- Helpers: Terrain & Collisions ---
  function isOverSolidGround(x) {
    return groundSegments.some((s) => x >= s.x1 && x <= s.x2);
  }

  function addParticles(x, y, colA, colB, count = 14, speedScale = 1) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (1.4 + Math.random() * 4.5) * speedScale;
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 0.8,
        r: 2.5 + Math.random() * 3.5,
        alpha: 1,
        decay: 0.03 + Math.random() * 0.02,
        color: i % 2 === 0 ? colA : colB
      });
    }
  }

  function showToast(title, desc) {
    const el = document.getElementById('contraToast');
    document.getElementById('cToastTitle').textContent = title;
    document.getElementById('cToastDesc').textContent = desc;
    el.classList.remove('hidden');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), 3000);
  }

  function addScore(pts) {
    score += pts;
    hudScore.textContent = String(score);

    // Check shared Cafe Voucher milestones (100 combat pts = 1 milestone pt)
    const milestoneUnits = Math.floor(score / 100);
    const unlocked = Hub.checkAndUnlockVouchers(milestoneUnits, 'Neon Contra', isDemoAI);
    if (unlocked.length > 0) {
      const newest = unlocked[0];
      lastRunVoucher = newest;
      updateMetaHUD();
      window.soundFX.reward();
      showToast('🎁 Mở khóa Voucher!', `${newest.reward} (${newest.code})`);
    }
  }

  function updateMetaHUD() {
    hudLives.textContent = '❤️'.repeat(Math.max(0, player.lives));
    hudWeapon.textContent = WEAPONS[player.weapon].name;
    contraVoucherCount.textContent = String(Hub.getWallet(isDemoAI).length);
    contraSoundIcon.textContent = window.soundFX.muted ? '🔇' : '🔊';
    document.getElementById('contraShopTag').textContent = Hub.getShopConfig().shopName;
  }

  // --- Weapon Firing ---
  function firePlayerWeapon() {
    const wCfg = WEAPONS[player.weapon];
    player.fireTimer = wCfg.cooldown;

    let dx = player.aimX;
    let dy = player.aimY;
    if (dx === 0 && dy === 0) dx = player.facing;
    const baseAngle = Math.atan2(dy, dx);

    const muzzleX = player.x + Math.cos(baseAngle) * 22;
    const muzzleY = (player.crouching ? player.y + 10 : player.y - 6) + Math.sin(baseAngle) * 18;

    window.soundFX.shoot(player.weapon);
    addParticles(muzzleX, muzzleY, wCfg.color, '#ffffff', 4, 0.55);

    if (player.weapon === 'S') {
      const spreadAngles = [-0.36, -0.18, 0, 0.18, 0.36];
      spreadAngles.forEach((off) => {
        const a = baseAngle + off;
        bullets.push({
          x: muzzleX,
          y: muzzleY,
          vx: Math.cos(a) * wCfg.speed,
          vy: Math.sin(a) * wCfg.speed,
          r: 5.5,
          dmg: wCfg.dmg,
          kind: 'S',
          color: wCfg.color,
          pierce: false,
          life: 68
        });
      });
    } else if (player.weapon === 'L') {
      bullets.push({
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(baseAngle) * wCfg.speed,
        vy: Math.sin(baseAngle) * wCfg.speed,
        r: 6,
        dmg: wCfg.dmg,
        kind: 'L',
        angle: baseAngle,
        color: wCfg.color,
        pierce: true,
        life: 62
      });
    } else if (player.weapon === 'F') {
      bullets.push({
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(baseAngle) * wCfg.speed,
        vy: Math.sin(baseAngle) * wCfg.speed,
        r: 8,
        dmg: wCfg.dmg,
        kind: 'F',
        phase: 0,
        color: wCfg.color,
        pierce: false,
        aoe: 56,
        life: 72
      });
    } else {
      bullets.push({
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(baseAngle) * wCfg.speed,
        vy: Math.sin(baseAngle) * wCfg.speed,
        r: 4.5,
        dmg: wCfg.dmg,
        kind: 'M',
        color: wCfg.color,
        pierce: false,
        life: 68
      });
    }
  }

  // --- AI Auto-Pilot Brain for Contra ---
  function computeContraAI() {
    const cmd = { left: false, right: false, up: false, down: false, jump: false, fire: true };

    // 1. Incoming Enemy Bullet Dodge
    let urgentDodgeJump = false;
    let urgentDuck = false;
    for (const eb of enemyBullets) {
      const dx = eb.x - player.x;
      const dy = eb.y - player.y;
      const approaching = (eb.vx < 0 && dx > -10 && dx < 145) || (eb.vx > 0 && dx < 10 && dx > -145) || Math.hypot(dx, dy) < 95;
      if (approaching && Math.abs(dy) < 38) {
        if (player.onGround) {
          if (dy < -8 && Math.abs(eb.vy) < 1.8) {
            urgentDuck = true;
          } else {
            urgentDodgeJump = true;
          }
        }
        break;
      }
    }

    // 2. Pick high-value Powerups nearby
    const desiredPower = powerups.find((p) => Math.abs(p.x - player.x) < 260 && p.y < groundY + 20);
    if (desiredPower) {
      if (desiredPower.x > player.x + 10) cmd.right = true;
      else if (desiredPower.x < player.x - 10) cmd.left = true;
      if (desiredPower.y < player.y - 35 && player.onGround) cmd.jump = true;
    } else if (!bossLocked) {
      // Advance steadily rightward through stage
      cmd.right = true;
      // Stop slightly back if a tough turret is right in front
      const closeBlocker = enemies.find((e) => e.x > player.x && e.x - player.x < 110 && Math.abs(e.y - player.y) < 45);
      if (closeBlocker) {
        cmd.right = false;
      }
    } else {
      // Boss Arena Positioning: patrol left arena platforms and keep optimal firing distance
      const idealX = stageLength - 290 + Math.sin(simClock * 2.1) * 75;
      if (player.x < idealX - 14) cmd.right = true;
      else if (player.x > idealX + 14) cmd.left = true;

      // Periodically hop onto arena platforms to hit high boss turrets
      if (player.onGround && Math.sin(simClock * 3.4) > 0.86) {
        cmd.jump = true;
      }
    }

    // 3. Chasm / Pit Jump Check!
    const lookDir = cmd.left ? -1 : 1;
    const probeX = player.x + lookDir * 34;
    if (player.onGround && !isOverSolidGround(probeX)) {
      cmd.jump = true;
      cmd.right = lookDir > 0;
      cmd.left = lookDir < 0;
    }
    // Also ensure while airborne over a pit we push forward onto solid ground
    if (!player.onGround && !isOverSolidGround(player.x)) {
      cmd.right = true;
      cmd.left = false;
    }

    if (urgentDodgeJump && player.onGround) cmd.jump = true;
    if (urgentDuck && !cmd.jump && !cmd.right && !cmd.left) cmd.down = true;

    // 4. Smart 8-Way Target Aiming
    let bestTarget = null;
    let bestScore = Infinity;

    // Priority A: Flying Weapon Capsule on screen (unless already carrying Spread S)
    for (const cap of capsules) {
      if (cap.spawned && cap.x > cameraX && cap.x < cameraX + viewW) {
        const d = Math.hypot(cap.x - player.x, cap.y - player.y) * 0.45;
        if (d < bestScore) {
          bestScore = d;
          bestTarget = { x: cap.x, y: cap.y };
        }
      }
    }

    // Priority B: Active Enemies on screen
    for (const en of enemies) {
      if (en.x > cameraX - 20 && en.x < cameraX + viewW + 30) {
        const d = Math.hypot(en.x - player.x, en.y - player.y);
        if (d < bestScore) {
          bestScore = d;
          bestTarget = { x: en.x, y: en.y };
        }
      }
    }

    // Priority C: Boss Turrets & Boss Core
    if (boss && boss.active && !boss.defeated) {
      for (const t of boss.turrets) {
        if (t.hp > 0) {
          const d = Math.hypot(t.x - player.x, t.y - player.y) * 0.85;
          if (d < bestScore) {
            bestScore = d;
            bestTarget = { x: t.x, y: t.y };
          }
        }
      }
      const dc = Math.hypot(boss.core.x - player.x, boss.core.y - player.y) * 0.9;
      if (dc < bestScore) {
        bestScore = dc;
        bestTarget = { x: boss.core.x, y: boss.core.y };
      }
    }

    if (bestTarget) {
      const ang = Math.atan2(bestTarget.y - (player.y - 6), bestTarget.x - player.x);
      const octant = Math.round(ang / (Math.PI / 4)); // -4..4
      // Convert octant into directional aim keys without breaking pit jump movement
      const cosV = Math.cos(octant * (Math.PI / 4));
      const sinV = Math.sin(octant * (Math.PI / 4));

      if (sinV < -0.35) cmd.up = true;
      else if (sinV > 0.35 && !player.onGround) cmd.down = true;

      if (Math.abs(cosV) < 0.35) {
        // Pure vertical target: briefly release horizontal if safe on solid ground to shoot straight up!
        if (player.onGround && isOverSolidGround(player.x + 30) && !urgentDodgeJump) {
          cmd.left = false;
          cmd.right = false;
        }
      } else if (cosV < -0.35 && player.onGround && isOverSolidGround(player.x - 36)) {
        cmd.left = true;
        cmd.right = false;
      }
    }

    return cmd;
  }

  // --- Player Damage & Respawn ---
  function damagePlayer() {
    if (player.invulnTimer > 0 || gameState !== 'PLAYING') return;

    // In AI Auto-Pilot showcase mode, grant emergency energy shield instead of dying so viewer can watch endlessly!
    if (aiEnabled && player.lives <= 1) {
      player.invulnTimer = 85;
      addParticles(player.x, player.y, '#00f5d4', '#ff2a85', 16);
      return;
    }

    player.lives -= 1;
    player.weapon = 'M';
    screenShake = 12;
    window.soundFX.playerHurt();
    addParticles(player.x, player.y, '#ff2a85', '#fbbf24', 26);
    updateMetaHUD();

    if (player.lives <= 0) {
      finishGame();
      return;
    }

    // Respawn safely above nearest solid ground
    player.invulnTimer = 120;
    player.vy = -4;
    player.y = groundY - 190;
    let safeX = Math.max(cameraX + 90, player.x - 40);
    for (let offset = 0; offset < 260; offset += 20) {
      if (isOverSolidGround(safeX + offset)) {
        safeX = safeX + offset;
        break;
      }
    }
    player.x = safeX;
  }

  function finishGame() {
    gameState = 'GAMEOVER';
    bossHud.classList.add('hidden');

    if (!isDemoAI) {
      const prevBest = parseInt(localStorage.getItem(Hub.KEYS.CONTRA_BEST) || '0', 10) || 0;
      const prevStage = parseInt(localStorage.getItem(Hub.KEYS.CONTRA_STAGE) || '0', 10) || 0;
      if (score > prevBest) localStorage.setItem(Hub.KEYS.CONTRA_BEST, String(score));
      if (stage > prevStage) localStorage.setItem(Hub.KEYS.CONTRA_STAGE, String(stage));
    }

    const bestShown = Math.max(
      score,
      parseInt(localStorage.getItem(Hub.KEYS.CONTRA_BEST) || '0', 10) || 0
    );

    document.getElementById('cFinalScore').textContent = String(score);
    document.getElementById('cFinalStage').textContent = `STAGE ${stage}`;
    document.getElementById('cBestScore').textContent = String(bestShown);
    document.getElementById('cMilestonePts').textContent = `${Math.floor(score / 100)}đ`;

    const vBox = document.getElementById('cNewVoucherBox');
    if (lastRunVoucher) {
      vBox.classList.remove('hidden');
      document.getElementById('cNewVoucherReward').textContent = lastRunVoucher.reward;
      document.getElementById('cNewVoucherCode').textContent = lastRunVoucher.code;
    } else {
      vBox.classList.add('hidden');
    }

    overOverlay.classList.add('active');
  }

  // --- Core Physics & Combat Tick (dt normalized to 60fps) ---
  function stepSimulation(dt) {
    if (screenShake > 0) screenShake = Math.max(0, screenShake - 0.8 * dt);

    if (gameState === 'STAGE_CLEAR') {
      stageClearTimer -= dt;
      updateParticles(dt);
      if (stageClearTimer <= 0) {
        // In AI mode, rotate character skin on each new stage so viewer sees all 3 characters!
        if (aiEnabled) {
          const chars = Hub.CHARACTERS;
          const nextIdx = (chars.findIndex((c) => c.id === currentCharId) + 1) % chars.length;
          currentCharId = chars[nextIdx].id;
          showToast(`✨ Đổi Chiến Binh: ${chars[nextIdx].name}`, chars[nextIdx].role);
        }
        player.lives = Math.min(5, player.lives + 1);
        gameState = 'PLAYING';
        buildStage(stage + 1);
        updateMetaHUD();
      }
      return;
    }

    if (gameState !== 'PLAYING') return;

    // Resolve Active Controls (AI vs Human Keyboard + Touch)
    let moveL = input.left || touchState.joyX < -0.35;
    let moveR = input.right || touchState.joyX > 0.35;
    let aimU = input.up || touchState.joyY < -0.35;
    let aimD = input.down || touchState.joyY > 0.35;
    let wantFire = input.fire || touchState.fire;
    let wantJump = input.jumpPressed || touchState.jump;

    // Strictly forbid AI Auto-Pilot during real player mode!
    if (!isDemoAI) {
      aiEnabled = false;
    }

    if (aiEnabled) {
      const aiCmd = computeContraAI();
      moveL = aiCmd.left;
      moveR = aiCmd.right;
      aimU = aiCmd.up;
      aimD = aiCmd.down;
      wantFire = aiCmd.fire;
      wantJump = aiCmd.jump;
    }

    // Horizontal Movement & Crouch
    const MOVE_SPD = 4.25;
    player.crouching = player.onGround && aimD && !moveL && !moveR && !aimU;

    if (moveL && !player.crouching) {
      player.vx = -MOVE_SPD;
      player.facing = -1;
    } else if (moveR && !player.crouching) {
      player.vx = MOVE_SPD;
      player.facing = 1;
    } else {
      player.vx = 0;
    }

    // Compute Aim Vector (supports both Mouse Cursor aim when clicking & 8-way AWSD aim!)
    if (!aiEnabled && input.mouseFiring) {
      const worldMouseX = input.mouseX + cameraX;
      const worldMouseY = input.mouseY;
      const mdx = worldMouseX - player.x;
      const mdy = worldMouseY - (player.y - 6);
      const len = Math.hypot(mdx, mdy) || 1;
      player.aimX = mdx / len;
      player.aimY = mdy / len;
      if (!moveL && !moveR) {
        player.facing = mdx >= 0 ? 1 : -1;
      }
    } else if (player.crouching) {
      player.aimX = player.facing;
      player.aimY = 0;
    } else {
      const ax = moveL ? -1 : moveR ? 1 : 0;
      const ay = aimU ? -1 : aimD ? 1 : 0;
      if (ax === 0 && ay === 0) {
        player.aimX = player.facing;
        player.aimY = 0;
      } else {
        player.aimX = ax;
        player.aimY = ay;
      }
    }

    // Jump & Drop-through Platform (Space to jump, Space + F in either order to drop down!)
    const onElevatedPlatform = player.onGround && player.y + player.h * 0.5 < groundY - 10;
    const touchDrop = touchState.joyY > 0.55 && touchState.jump;
    const keyDropCombo =
      !aiEnabled &&
      ((input.dropMod && input.jumpPressed) ||
        (input.jump && input.dropPressed) ||
        (input.dropMod && input.jump));

    if (player.recentPlatformTimer > 0) player.recentPlatformTimer -= dt;

    // Chord forgiveness: if Space started a jump off an elevated platform moments ago and F arrives right after
    if (!aiEnabled && input.jump && input.dropPressed && player.recentPlatformTimer > 0) {
      player.recentPlatformTimer = 0;
      player.dropThroughTimer = 14;
      player.onGround = false;
      player.vy = 2.2;
      player.y = player.recentPlatformY - player.h * 0.5 + 8;
    } else if (onElevatedPlatform && (keyDropCombo || touchDrop)) {
      player.dropThroughTimer = 14;
      player.onGround = false;
      player.vy = 2.0;
      player.y += 7;
    } else if (wantJump && player.onGround) {
      if (onElevatedPlatform) {
        player.recentPlatformTimer = 9;
        player.recentPlatformY = player.y + player.h * 0.5;
      } else {
        player.recentPlatformTimer = 0;
      }
      player.vy = -10.8;
      player.onGround = false;
      player.crouching = false;
      window.soundFX.jump();
    }

    input.jumpPressed = false;
    input.dropPressed = false;
    touchState.jump = false;

    if (player.dropThroughTimer > 0) player.dropThroughTimer -= dt;
    if (player.invulnTimer > 0) player.invulnTimer -= dt;

    // Apply Gravity & Move Player
    const prevBottom = player.y + player.h * 0.5;
    player.vy = Math.min(12.5, player.vy + 0.48 * dt);
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Clamp X inside camera & arena bounds
    const maxRightX = bossLocked ? stageLength + 5 : stageLength + 100;
    player.x = Math.max(cameraX + 20, Math.min(maxRightX, player.x));

    // Animation Phases
    if (!player.onGround) {
      player.somersaultAngle += 0.34 * player.facing * dt;
    } else {
      player.somersaultAngle = 0;
      if (Math.abs(player.vx) > 0.1) player.runPhase += 0.26 * dt;
      else player.runPhase = 0;
    }

    // Platform & Ground Landing Collisions
    player.onGround = false;
    const newBottom = player.y + player.h * 0.5;

    if (player.vy >= 0) {
      // Elevated one-way platforms
      if (player.dropThroughTimer <= 0) {
        for (const pf of platforms) {
          if (
            player.x + 10 >= pf.x &&
            player.x - 10 <= pf.x + pf.w &&
            prevBottom <= pf.y + 8 &&
            newBottom >= pf.y
          ) {
            player.y = pf.y - player.h * 0.5;
            player.vy = 0;
            player.onGround = true;
            break;
          }
        }
      }

      // Main ground segments
      if (!player.onGround && isOverSolidGround(player.x)) {
        if (prevBottom <= groundY + 12 && newBottom >= groundY) {
          player.y = groundY - player.h * 0.5;
          player.vy = 0;
          player.onGround = true;
        }
      }
    }

    // Pit Fall Check
    if (player.y > viewH + 50) {
      if (aiEnabled) {
        player.vy = -12;
        player.y = groundY - 120;
        player.x += 55;
      } else {
        damagePlayer();
      }
    }

    // Camera Scrolling & Boss Arena Lock
    const targetCam = Math.max(cameraX, player.x - viewW * 0.34);
    const bossArenaCam = Math.max(0, stageLength - viewW + 210);
    if (!bossLocked && targetCam >= bossArenaCam) {
      cameraX = bossArenaCam;
      bossLocked = true;
      boss.active = true;
      bossTitle.textContent = `👾 PHÁO ĐÀI TRÙM — STAGE ${stage}`;
      bossHud.classList.remove('hidden');
      showToast('⚠️ CẢNH BÁO BOSS!', 'Phá hủy các Ụ Pháo và Lõi Năng Lượng Trung Tâm!');
    } else if (!bossLocked) {
      cameraX = Math.min(bossArenaCam, targetCam);
    }

    // Weapon Cooldown & Firing
    if (player.fireTimer > 0) player.fireTimer -= dt;
    if (wantFire && player.fireTimer <= 0) {
      firePlayerWeapon();
    }

    // Dynamic Wave Spawns (Original intense pacing)
    spawnWaveTimer -= dt;
    if (spawnWaveTimer <= 0) {
      spawnWaveTimer = bossLocked ? 95 : Math.max(46, 84 - stage * 6);
      if (!bossLocked) {
        enemies.push({
          type: 'runner',
          x: cameraX + viewW + 30,
          y: groundY - 24,
          vx: -(2.5 + Math.min(1.8, stage * 0.25)),
          vy: 0,
          w: 24,
          h: 46,
          hp: 1,
          maxHp: 1,
          onGround: true
        });
        if (Math.random() < 0.42) {
          enemies.push({
            type: 'drone',
            x: cameraX + viewW + 40,
            y: groundY - 165 - Math.random() * 55,
            baseY: groundY - 175,
            phase: Math.random() * Math.PI * 2,
            vx: -2.2,
            w: 30,
            h: 24,
            hp: 2,
            maxHp: 2,
            shootTimer: 55
          });
        }
      } else if (boss && !boss.defeated) {
        // Periodic support drone or capsule during boss battle!
        capsuleSpawnTimer -= 35;
        if (capsuleSpawnTimer <= 0) {
          capsuleSpawnTimer = 140;
          capsules.push({
            triggerX: 0,
            spawned: true,
            x: cameraX - 20,
            y: groundY - 220,
            baseY: groundY - 220,
            phase: 0,
            item: player.weapon === 'S' ? 'L' : 'S'
          });
        }
      }
    }

    // Update Flying Weapon Capsules
    for (let i = capsules.length - 1; i >= 0; i--) {
      const cap = capsules[i];
      if (!cap.spawned) {
        if (player.x >= cap.triggerX) {
          cap.spawned = true;
          cap.x = cameraX - 30;
          cap.baseY = Math.max(95, groundY - 215);
        }
        continue;
      }
      cap.x += 3.2 * dt;
      cap.phase += 0.08 * dt;
      cap.y = cap.baseY + Math.sin(cap.phase) * 28;
      if (cap.x > cameraX + viewW + 80) {
        capsules.splice(i, 1);
      }
    }

    // Update Dropped Powerup Badges
    for (let i = powerups.length - 1; i >= 0; i--) {
      const pw = powerups[i];
      pw.vy = Math.min(8, pw.vy + 0.35 * dt);
      pw.y += pw.vy * dt;

      for (const pf of platforms) {
        if (pw.x >= pf.x && pw.x <= pf.x + pf.w && pw.y + 14 >= pf.y && pw.y - pw.vy <= pf.y + 6) {
          pw.y = pf.y - 14;
          pw.vy = 0;
        }
      }
      if (isOverSolidGround(pw.x) && pw.y + 14 >= groundY) {
        pw.y = groundY - 14;
        pw.vy = 0;
      }

      // Player pickup check
      if (Math.hypot(pw.x - player.x, pw.y - player.y) < 34) {
        window.soundFX.powerup();
        if (pw.item === '♥') {
          player.lives = Math.min(5, player.lives + 1);
          showToast('❤️ Tiếp tế Quân Y!', '+1 Mạng chiến đấu');
        } else {
          player.weapon = pw.item;
          showToast(`🔫 Nâng cấp Vũ khí: ${WEAPONS[pw.item].name}`, 'Hỏa lực tối đa đã kích hoạt!');
        }
        addScore(150);
        updateMetaHUD();
        addParticles(pw.x, pw.y, '#fbbf24', '#00f5d4', 16);
        powerups.splice(i, 1);
      }
    }

    // Update Player Bullets & Hit Detection
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.kind === 'F') b.phase += 0.3 * dt;

      if (b.life <= 0 || b.x < cameraX - 60 || b.x > cameraX + viewW + 80 || b.y < -60 || b.y > viewH + 60) {
        bullets.splice(i, 1);
        continue;
      }

      let consumed = false;

      // Hit Flying Capsule?
      for (let c = capsules.length - 1; c >= 0; c--) {
        const cap = capsules[c];
        if (cap.spawned && Math.hypot(b.x - cap.x, b.y - cap.y) < 24) {
          powerups.push({ x: cap.x, y: cap.y, vy: -4.5, item: cap.item });
          addParticles(cap.x, cap.y, '#fbbf24', '#ff2a85', 14);
          window.soundFX.enemyBoom();
          capsules.splice(c, 1);
          if (!b.pierce) consumed = true;
          break;
        }
      }
      if (consumed) {
        bullets.splice(i, 1);
        continue;
      }

      // Hit Regular Enemies?
      for (let e = enemies.length - 1; e >= 0; e--) {
        const en = enemies[e];
        if (Math.abs(b.x - en.x) < en.w * 0.6 + b.r && Math.abs(b.y - en.y) < en.h * 0.55 + b.r) {
          en.hp -= b.dmg;
          if (b.aoe) {
            addParticles(b.x, b.y, '#fbbf24', '#ff2a85', 14, 1.2);
            enemies.forEach((other) => {
              if (other !== en && Math.hypot(other.x - b.x, other.y - b.y) < b.aoe) {
                other.hp -= b.dmg * 0.75;
              }
            });
          } else {
            addParticles(b.x, b.y, b.color, '#ffffff', 5, 0.6);
          }

          if (!b.pierce) consumed = true;
          break;
        }
      }

      // Hit Boss Turrets or Boss Core?
      if (!consumed && boss && boss.active && !boss.defeated) {
        for (const t of boss.turrets) {
          if (t.hp > 0 && Math.hypot(b.x - t.x, b.y - t.y) < 24 + b.r) {
            t.hp -= b.dmg;
            addParticles(b.x, b.y, '#fbbf24', '#ff2a85', 6, 0.7);
            if (t.hp <= 0) {
              window.soundFX.enemyBoom();
              screenShake = 8;
              addParticles(t.x, t.y, '#ff2a85', '#fbbf24', 24, 1.3);
              addScore(500);
            }
            if (!b.pierce) consumed = true;
            break;
          }
        }

        if (!consumed && Math.hypot(b.x - boss.core.x, b.y - boss.core.y) < boss.core.r + b.r) {
          boss.core.hp -= b.dmg;
          boss.core.flash = 5;
          addParticles(b.x, b.y, '#00f5d4', '#ff2a85', 7, 0.8);
          if (!b.pierce) consumed = true;

          if (boss.core.hp <= 0) {
            boss.defeated = true;
            bossHud.classList.add('hidden');
            enemyBullets = [];
            enemies = [];
            screenShake = 20;
            window.soundFX.bossExplosion();
            setTimeout(() => window.soundFX.stageClear(), 450);
            addParticles(boss.core.x, boss.core.y, '#ff2a85', '#fbbf24', 55, 1.8);
            addParticles(boss.core.x - 20, boss.core.y - 60, '#00f5d4', '#ffffff', 35, 1.5);
            addScore(1500);
            announceStage(`STAGE ${stage} CLEAR!`, '+1500 ĐIỂM THƯỞNG CHIẾN DỊCH');
            gameState = 'STAGE_CLEAR';
            stageClearTimer = 140;
          }
        }
      }

      if (consumed) bullets.splice(i, 1);
    }

    // Clean up killed enemies & award score
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].hp <= 0) {
        const dead = enemies[i];
        window.soundFX.enemyBoom();
        addParticles(dead.x, dead.y, '#ff2a85', '#fbbf24', 14);
        const ptsMap = { runner: 100, sniper: 200, drone: 250, turret: 350 };
        addScore(ptsMap[dead.type] || 100);
        enemies.splice(i, 1);
      }
    }

    // Update Active Enemies (Original tough hitboxes & fast projectiles)
    const pHitH = player.crouching ? 26 : 44;
    const pCenterY = player.crouching ? player.y + 12 : player.y;

    for (let i = enemies.length - 1; i >= 0; i--) {
      const en = enemies[i];
      if (en.x < cameraX - 120) {
        enemies.splice(i, 1);
        continue;
      }
      if (en.x > cameraX + viewW + 90) continue;

      if (en.type === 'runner') {
        en.x += en.vx * dt;
        if (en.onGround && !isOverSolidGround(en.x - 20)) {
          en.vy = -9.2;
          en.onGround = false;
        }
        en.vy = Math.min(11, (en.vy || 0) + 0.45 * dt);
        en.y += en.vy * dt;
        if (isOverSolidGround(en.x) && en.y + 23 >= groundY) {
          en.y = groundY - 23;
          en.vy = 0;
          en.onGround = true;
        }
        if (en.y > viewH + 60) {
          enemies.splice(i, 1);
          continue;
        }
      } else if (en.type === 'drone') {
        en.x += en.vx * dt;
        en.phase += 0.065 * dt;
        en.y = en.baseY + Math.sin(en.phase) * 32;
        en.shootTimer -= dt;
        if (en.shootTimer <= 0) {
          en.shootTimer = 85;
          const a = Math.atan2(pCenterY - en.y, player.x - en.x);
          enemyBullets.push({ x: en.x, y: en.y, vx: Math.cos(a) * 4.4, vy: Math.sin(a) * 4.4, r: 5 });
        }
      } else if (en.type === 'sniper' || en.type === 'turret') {
        const ang = Math.atan2(pCenterY - en.y, player.x - en.x);
        en.angle = ang;
        en.shootTimer -= dt;
        if (en.shootTimer <= 0) {
          en.shootTimer = en.type === 'turret' ? Math.max(48, 82 - stage * 5) : Math.max(55, 92 - stage * 5);
          const spd = en.type === 'turret' ? 4.8 : 4.3;
          enemyBullets.push({
            x: en.x + Math.cos(ang) * 16,
            y: en.y + Math.sin(ang) * 16,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            r: 5.5
          });
        }
      }

      // Direct contact damage
      if (Math.abs(en.x - player.x) < (en.w + 20) * 0.5 && Math.abs(en.y - pCenterY) < (en.h + pHitH) * 0.45) {
        damagePlayer();
      }
    }

    // Update Boss AI & Boss HUD
    if (boss && boss.active && !boss.defeated) {
      if (boss.core.flash > 0) boss.core.flash -= dt;

      const totalHp =
        Math.max(0, boss.core.hp) +
        boss.turrets.reduce((sum, t) => sum + Math.max(0, t.hp), 0);
      const totalMax =
        boss.core.maxHp + boss.turrets.reduce((sum, t) => sum + t.maxHp, 0);
      bossBarFill.style.width = `${Math.max(0, (totalHp / totalMax) * 100)}%`;

      for (const t of boss.turrets) {
        if (t.hp <= 0) continue;
        t.shootTimer -= dt;
        if (t.shootTimer <= 0) {
          t.shootTimer = t.kind === 'laser' ? Math.max(46, 76 - stage * 5) : Math.max(64, 96 - stage * 5);
          if (t.kind === 'laser') {
            const a = Math.atan2(pCenterY - t.y, player.x - t.x);
            enemyBullets.push({ x: t.x - 12, y: t.y, vx: Math.cos(a) * 5.2, vy: Math.sin(a) * 5.2, r: 6 });
          } else {
            enemyBullets.push({
              x: t.x - 12,
              y: t.y,
              vx: -(3.6 + Math.random() * 2.2),
              vy: -6.5,
              gravity: 0.18,
              r: 7
            });
          }
        }
      }

      // Boss Core radial burst
      boss.core.shootTimer -= dt;
      if (boss.core.shootTimer <= 0) {
        const enraged = boss.core.hp < boss.core.maxHp * 0.5;
        boss.core.shootTimer = enraged ? 62 : 92;
        const angles = enraged ? [Math.PI - 0.35, Math.PI, Math.PI + 0.35] : [Math.PI - 0.18, Math.PI + 0.18];
        angles.forEach((a) => {
          enemyBullets.push({
            x: boss.core.x - 20,
            y: boss.core.y,
            vx: Math.cos(a) * 4.8,
            vy: Math.sin(a) * 4.8,
            r: 6.5
          });
        });
      }
    }

    // Update Enemy Bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const eb = enemyBullets[i];
      if (eb.gravity) eb.vy += eb.gravity * dt;
      eb.x += eb.vx * dt;
      eb.y += eb.vy * dt;

      if (eb.x < cameraX - 60 || eb.x > cameraX + viewW + 60 || eb.y > viewH + 50 || eb.y < -80) {
        enemyBullets.splice(i, 1);
        continue;
      }

      if (Math.abs(eb.x - player.x) < 13 + eb.r && Math.abs(eb.y - pCenterY) < pHitH * 0.45 + eb.r) {
        enemyBullets.splice(i, 1);
        damagePlayer();
      }
    }

    updateParticles(dt);
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  // --- Rendering ---
  function renderScene() {
    ctx.save();
    if (screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    }

    // Parallax Cyber-Jungle Night Sky
    const sky = ctx.createLinearGradient(0, 0, 0, viewH);
    sky.addColorStop(0, '#050714');
    sky.addColorStop(0.65, '#120a2a');
    sky.addColorStop(1, '#090d1c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, viewW, viewH);

    // Distant Neon Mountains (Parallax 0.2x)
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.16)';
    ctx.fillStyle = '#0a0f24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (let sx = -100; sx <= viewW + 160; sx += 140) {
      const worldPeak = Math.floor((sx + cameraX * 0.2) / 140);
      const peakH = 95 + ((Math.sin(worldPeak * 1.7) + 1) * 55);
      ctx.lineTo(sx, groundY - peakH);
    }
    ctx.lineTo(viewW, groundY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Midground Cyber Ruins Pillars (Parallax 0.45x)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.strokeStyle = 'rgba(255, 42, 133, 0.16)';
    const pillarStep = 220;
    const firstPillar = Math.floor((cameraX * 0.45) / pillarStep) * pillarStep;
    for (let px = firstPillar; px < cameraX * 0.45 + viewW + pillarStep; px += pillarStep) {
      const drawX = px - cameraX * 0.45;
      const h = 70 + (Math.abs(Math.sin(px * 0.03)) * 85);
      ctx.fillRect(drawX, groundY - h, 34, h);
      ctx.strokeRect(drawX, groundY - h, 34, h);
    }

    ctx.save();
    ctx.translate(-cameraX, 0);

    // Draw Chasm Abyss Glow
    ctx.fillStyle = 'rgba(255, 42, 133, 0.08)';
    ctx.fillRect(cameraX, groundY + 10, viewW, viewH - groundY);

    // Draw Solid Ground Segments
    for (const seg of groundSegments) {
      if (seg.x2 < cameraX - 40 || seg.x1 > cameraX + viewW + 40) continue;
      const w = seg.x2 - seg.x1;
      ctx.fillStyle = '#0b132b';
      ctx.fillRect(seg.x1, groundY, w, viewH - groundY + 40);

      // Cyber turf top neon line
      ctx.save();
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(seg.x1, groundY);
      ctx.lineTo(seg.x2, groundY);
      ctx.stroke();
      ctx.restore();

      // Tech diagonal stripes
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.16)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let gx = seg.x1 + 16; gx < seg.x2 - 10; gx += 36) {
        ctx.moveTo(gx, groundY);
        ctx.lineTo(gx - 16, groundY + 28);
      }
      ctx.stroke();
    }

    // Draw Elevated One-Way Platforms
    for (const pf of platforms) {
      if (pf.x + pf.w < cameraX - 30 || pf.x > cameraX + viewW + 30) continue;
      ctx.save();
      ctx.fillStyle = '#162042';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.fillRect(pf.x, pf.y, pf.w, 12);
      ctx.strokeRect(pf.x, pf.y, pf.w, 12);
      ctx.restore();
    }

    // Draw Boss Cyber Fortress Wall
    if (boss && !boss.defeated && boss.x < cameraX + viewW + 120) {
      drawBossFortress();
    }

    // Draw Flying Capsules
    for (const cap of capsules) {
      if (!cap.spawned) continue;
      ctx.save();
      ctx.translate(cap.x, cap.y);
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ff2a85';
      ctx.font = '900 12px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cap.item, 0, 1);
      ctx.restore();
    }

    // Draw Dropped Powerup Badges
    for (const pw of powerups) {
      ctx.save();
      ctx.translate(pw.x, pw.y);
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 14;
      ctx.fillRect(-15, -13, 30, 26);
      ctx.strokeRect(-15, -13, 30, 26);

      ctx.fillStyle = '#fbbf24';
      ctx.font = '900 14px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pw.item, 0, 1);
      ctx.restore();
    }

    // Draw Enemies
    for (const en of enemies) {
      if (en.x < cameraX - 50 || en.x > cameraX + viewW + 50) continue;
      drawEnemy(en);
    }

    // Draw Hero (Commando with Selected Photo Portrait!)
    drawCommandoHero();

    // Draw Player Bullets
    for (const b of bullets) {
      ctx.save();
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      if (b.kind === 'L') {
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle || 0);
        ctx.fillRect(-18, -3, 36, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-14, -1.2, 28, 2.4);
      } else if (b.kind === 'F') {
        ctx.translate(b.x, b.y);
        ctx.beginPath();
        ctx.arc(0, 0, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(Math.cos(b.phase) * 3, Math.sin(b.phase) * 3, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw Enemy Bullets
    for (const eb of enemyBullets) {
      ctx.save();
      ctx.fillStyle = '#ff2a85';
      ctx.shadowColor = '#ff2a85';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, eb.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, eb.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Explosions & Sparks
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
    ctx.restore();
  }

  function drawCommandoHero() {
    if (player.invulnTimer > 0 && Math.floor(player.invulnTimer / 4) % 2 === 1) {
      ctx.globalAlpha = 0.45;
    }

    const charCfg = Hub.getCharacterById(currentCharId);
    const avatarImg = Hub.avatarCache[charCfg.id];

    ctx.save();
    ctx.translate(player.x, player.y);

    // Shield Aura if invulnerable
    if (player.invulnTimer > 0) {
      ctx.save();
      ctx.strokeStyle = charCfg.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Airborne Contra Somersault Spin!
    const inSomersault = !player.onGround;
    if (inSomersault) {
      ctx.rotate(player.somersaultAngle * 0.35);
    }

    const bodyOffsetY = player.crouching ? 12 : 0;
    const headY = player.crouching ? -4 : -18;
    const headR = 16.5;

    // 1. Legs (running stride or tucked somersault)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const legSwing = inSomersault ? 6 : Math.sin(player.runPhase) * 10;
    if (player.crouching) {
      ctx.beginPath();
      ctx.moveTo(-6, 18);
      ctx.lineTo(-16 * player.facing, 25);
      ctx.moveTo(4, 18);
      ctx.lineTo(12 * player.facing, 25);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-3, 10);
      ctx.lineTo(-5 + legSwing, 26);
      ctx.moveTo(3, 10);
      ctx.lineTo(5 - legSwing, 26);
      ctx.stroke();
    }

    // 2. Armored Neon Vest Torso
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = charCfg.primary;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-10, -4 + bodyOffsetY, 20, 18, 5);
    ctx.fill();
    ctx.stroke();

    // 3. Flowing Red Contra Headband Ribbons behind head!
    const windWave = Math.sin(simClock * 11) * 4;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-player.facing * 12, headY - 6);
    ctx.quadraticCurveTo(
      -player.facing * 24,
      headY - 10 + windWave,
      -player.facing * 31,
      headY - 2 + windWave
    );
    ctx.moveTo(-player.facing * 12, headY - 4);
    ctx.quadraticCurveTo(
      -player.facing * 22,
      headY + 1 - windWave * 0.7,
      -player.facing * 28,
      headY + 7 - windWave
    );
    ctx.stroke();

    // 4. Custom Photo Portrait Head!
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, Math.PI * 2);
    ctx.clip();
    if (avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0) {
      ctx.drawImage(avatarImg, -headR, headY - headR, headR * 2, headR * 2);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(-headR, headY - headR, headR * 2, headR * 2);
    }
    ctx.restore();

    // Glowing Portrait Ring + Red Headband Across Forehead
    ctx.strokeStyle = charCfg.primary;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-headR + 1, headY - headR + 4, headR * 2 - 2, 4.5);

    // 5. 8-Directional Heavy Plasma Rifle
    const gunAng = Math.atan2(player.aimY, player.aimX || player.facing);
    ctx.save();
    ctx.translate(0, 2 + bodyOffsetY);
    ctx.rotate(gunAng);
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = WEAPONS[player.weapon].color;
    ctx.lineWidth = 2;
    ctx.fillRect(2, -3.5, 24, 7);
    ctx.strokeRect(2, -3.5, 24, 7);
    ctx.restore();

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawEnemy(en) {
    ctx.save();
    ctx.translate(en.x, en.y);

    if (en.type === 'turret') {
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#ff2a85';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ff2a85';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.rotate(en.angle || Math.PI);
      ctx.fillStyle = '#fda4af';
      ctx.fillRect(0, -4, 22, 8);
    } else if (en.type === 'drone') {
      ctx.fillStyle = '#311042';
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(16, 0);
      ctx.lineTo(0, 12);
      ctx.lineTo(-16, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Enemy cyber soldier (Runner / Sniper)
      const col = en.type === 'sniper' ? '#fbbf24' : '#fb7185';
      ctx.fillStyle = '#1f122b';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.fillRect(-10, -14, 20, 36);
      ctx.strokeRect(-10, -14, 20, 36);
      // Visor eye
      ctx.fillStyle = col;
      ctx.fillRect(-9, -10, 10, 5);
    }

    ctx.restore();
  }

  function drawBossFortress() {
    const bx = boss.x;
    ctx.save();

    // Armored Fortress Bulkhead
    ctx.fillStyle = '#120d26';
    ctx.strokeStyle = '#ff2a85';
    ctx.lineWidth = 3;
    ctx.fillRect(bx, groundY - 275, 160, 275);
    ctx.strokeRect(bx, groundY - 275, 160, 275);

    // Boss Sub-Turrets
    for (const t of boss.turrets) {
      ctx.save();
      ctx.translate(t.x, t.y);
      if (t.hp > 0) {
        ctx.fillStyle = '#3b0764';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 19, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.fillRect(-24, -5, 22, 10);
      } else {
        // Destroyed scorched socket
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Pulsing Central Energy Core
    const c = boss.core;
    const pulse = 1 + Math.sin(simClock * 8) * 0.08;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = c.flash > 0 ? '#ffffff' : '#ff2a85';
    ctx.strokeStyle = '#00f5d4';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#ff2a85';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(0, 0, c.r * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // --- Main RAF Loop ---
  let lastT = performance.now();
  function loop(now) {
    const rawDt = Math.min(2.0, Math.max(0.1, (now - lastT) / 16.6667));
    lastT = now;

    const steps = simSpeed > 1 ? simSpeed : 1;
    const stepDt = simSpeed > 1 ? 1.0 : rawDt;

    for (let s = 0; s < steps; s++) {
      simClock += (stepDt * 16.6667) * 0.001;
      stepSimulation(stepDt);
    }

    renderScene();
    requestAnimationFrame(loop);
  }

  // --- Start / Reset Campaign ---
  function startNewCampaign(withAI = false) {
    // Only allow AI if page was explicitly opened in Demo Showcase mode (?autoplay=1)
    aiEnabled = isDemoAI ? Boolean(withAI) : false;
    syncAIBarUI();
    score = 0;
    lastRunVoucher = null;
    player.lives = 3;
    player.weapon = aiEnabled ? 'S' : 'M';
    currentCharId = Hub.getSelectedCharacterId(isDemoAI);
    hudScore.textContent = '0';

    startOverlay.classList.remove('active');
    overOverlay.classList.remove('active');
    gameState = 'PLAYING';
    buildStage(1);
    updateMetaHUD();
  }

  function syncAIBarUI() {
    const aiBar = document.getElementById('contraAiBar');
    if (!isDemoAI) {
      aiBar.classList.add('hidden');
      return;
    }
    aiBar.classList.remove('hidden');
    cAiDot.classList.remove('off');
    cAiLabel.textContent = 'CHẾ ĐỘ XEM AI VẬN HÀNH';
    btnContraEndNow.classList.remove('hidden');
  }

  // --- Input Bindings (Keyboard, Mouse, Virtual Touch Joystick) ---
  window.addEventListener('resize', resize);

  window.addEventListener('keydown', (e) => {
    const gameKeys = ['KeyA', 'KeyW', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'Space'];
    if (gameState === 'PLAYING' && gameKeys.includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === 'KeyA') input.left = true;
    if (e.code === 'KeyD') input.right = true;
    if (e.code === 'KeyW') input.up = true;
    if (e.code === 'KeyS') input.down = true;
    if (e.code === 'KeyF') {
      if (!input.dropMod) input.dropPressed = true;
      input.dropMod = true;
    }
    if (e.code === 'KeyJ') input.fire = true;
    if (e.code === 'Space') {
      if (!input.jump) input.jumpPressed = true;
      input.jump = true;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyA') input.left = false;
    if (e.code === 'KeyD') input.right = false;
    if (e.code === 'KeyW') input.up = false;
    if (e.code === 'KeyS') input.down = false;
    if (e.code === 'KeyF') input.dropMod = false;
    if (e.code === 'KeyJ') input.fire = false;
    if (e.code === 'Space') input.jump = false;
  });

  canvas.addEventListener('pointerdown', (e) => {
    window.soundFX.init();
    const useCanvasAim = e.pointerType === 'mouse' || touchControls.classList.contains('hidden');
    if (!aiEnabled && gameState === 'PLAYING' && useCanvasAim) {
      const pt = window.MobileLandscape
        ? window.MobileLandscape.toGamePoint(e.clientX, e.clientY)
        : { x: e.clientX, y: e.clientY };
      input.fire = true;
      input.mouseFiring = true;
      input.mouseX = pt.x;
      input.mouseY = pt.y;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (input.mouseFiring) {
      const pt = window.MobileLandscape
        ? window.MobileLandscape.toGamePoint(e.clientX, e.clientY)
        : { x: e.clientX, y: e.clientY };
      input.mouseX = pt.x;
      input.mouseY = pt.y;
    }
  });
  window.addEventListener('pointerup', () => {
    input.fire = false;
    input.mouseFiring = false;
  });

  // Virtual Joystick & Touch Multi-button Handling
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouchDevice && !isDemoAI) {
    touchControls.classList.remove('hidden');
  }

  document.getElementById('btnTouchToggle').addEventListener('click', () => {
    touchControls.classList.toggle('hidden');
    window.soundFX.click();
  });

  const joyZone = document.getElementById('joyZone');
  const joyStick = document.getElementById('joyStick');
  let joyPointerId = null;

  function updateJoystick(clientX, clientY) {
    const rect = joyZone.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const maxR = Math.min(rect.width, rect.height) * 0.38 || 44;
    const mapped = window.MobileLandscape
      ? window.MobileLandscape.toGameDelta(clientX - cx, clientY - cy)
      : { dx: clientX - cx, dy: clientY - cy };
    let dx = mapped.dx;
    let dy = mapped.dy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
    touchState.joyX = dx / maxR;
    touchState.joyY = dy / maxR;
  }

  joyZone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joyPointerId = e.pointerId;
    joyZone.setPointerCapture(e.pointerId);
    updateJoystick(e.clientX, e.clientY);
  });
  joyZone.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyPointerId) updateJoystick(e.clientX, e.clientY);
  });
  function resetJoy(e) {
    if (e.pointerId === joyPointerId) {
      joyPointerId = null;
      joyStick.style.transform = 'translate(0px, 0px)';
      touchState.joyX = 0;
      touchState.joyY = 0;
    }
  }
  joyZone.addEventListener('pointerup', resetJoy);
  joyZone.addEventListener('pointercancel', resetJoy);

  const btnTouchFire = document.getElementById('btnTouchFire');
  const btnTouchJump = document.getElementById('btnTouchJump');

  btnTouchFire.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    window.soundFX.init();
    touchState.fire = true;
    btnTouchFire.classList.add('pressed');
  });
  btnTouchFire.addEventListener('pointerup', () => {
    touchState.fire = false;
    btnTouchFire.classList.remove('pressed');
  });
  btnTouchFire.addEventListener('pointercancel', () => {
    touchState.fire = false;
    btnTouchFire.classList.remove('pressed');
  });

  btnTouchJump.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    window.soundFX.init();
    touchState.jump = true;
    btnTouchJump.classList.add('pressed');
  });
  btnTouchJump.addEventListener('pointerup', () => btnTouchJump.classList.remove('pressed'));

  // --- UI Buttons & Modals ---
  document.getElementById('btnContraStart').addEventListener('click', () => {
    window.soundFX.click();
    isDemoAI = false;
    startNewCampaign(false);
  });

  document.getElementById('btnContraStartAI').addEventListener('click', () => {
    window.soundFX.click();
    isDemoAI = true;
    startNewCampaign(true);
  });

  document.getElementById('btnContraRetry').addEventListener('click', () => {
    window.soundFX.click();
    startNewCampaign(aiEnabled);
  });

  btnToggleContraAI.addEventListener('click', () => {
    // Disabled in normal play mode so players cannot toggle AI mid-game
    if (!isDemoAI) return;
  });

  document.querySelectorAll('.c-speed').forEach((btn) => {
    btn.addEventListener('click', () => {
      simSpeed = Number(btn.dataset.spd) || 1;
      document.querySelectorAll('.c-speed').forEach((b) => b.classList.toggle('active', b === btn));
      window.soundFX.click();
    });
  });

  btnContraEndNow.addEventListener('click', () => {
    finishGame();
  });

  document.getElementById('btnContraSound').addEventListener('click', () => {
    window.soundFX.toggleMute();
    updateMetaHUD();
  });

  document.getElementById('btnCopyContraVoucher').addEventListener('click', (e) => {
    if (lastRunVoucher && navigator.clipboard) {
      navigator.clipboard.writeText(lastRunVoucher.code);
      e.target.textContent = 'Đã chép!';
      setTimeout(() => (e.target.textContent = 'Sao chép'), 1400);
    }
  });

  function openCharPicker() {
    const list = document.getElementById('contraCharList');
    list.innerHTML = '';
    Hub.CHARACTERS.forEach((c) => {
      const div = document.createElement('div');
      div.className = 'c-char-item' + (c.id === currentCharId ? ' selected' : '');
      div.innerHTML = `
        <img src="${c.avatar}" alt="${c.name}" style="border:2px solid ${c.primary}" />
        <div>
          <div style="font-weight:800">${c.name}</div>
          <div style="font-size:0.76rem;color:#94a3b8">${c.role}</div>
        </div>
      `;
      div.addEventListener('click', () => {
        currentCharId = c.id;
        Hub.setSelectedCharacterId(c.id, isDemoAI);
        window.soundFX.click();
        openCharPicker();
      });
      list.appendChild(div);
    });
    charModal.classList.add('active');
  }

  function openWalletModal() {
    const cfg = Hub.getShopConfig();
    const wallet = Hub.getWallet(isDemoAI);
    const tierEl = document.getElementById('contraTierList');
    const listEl = document.getElementById('contraWalletList');

    tierEl.innerHTML = '';
    [...cfg.tiers]
      .sort((a, b) => a.score - b.score)
      .forEach((t) => {
        const has = wallet.some((w) => w.tierScore === t.score);
        const d = document.createElement('div');
        d.style.cssText = 'display:flex;justify-content:space-between;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,0.05);font-size:0.8rem';
        d.innerHTML = `<span>${has ? '✅' : '🔒'} ${t.reward}</span><strong style="color:#00f5d4">${t.score * 100} điểm</strong>`;
        tierEl.appendChild(d);
      });

    listEl.innerHTML = wallet.length
      ? wallet
          .map(
            (v) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 10px;border-radius:10px;background:rgba(0,245,212,0.08);border:1px solid rgba(0,245,212,0.3);font-size:0.8rem">
          <div><strong>${v.reward}</strong><div style="font-size:0.7rem;color:#94a3b8">${v.game || 'Arcade'} • ${v.date}</div></div>
          <code>${v.code}</code>
        </div>`
          )
          .join('')
      : `<div style="font-size:0.82rem;color:#94a3b8;text-align:center;padding:8px">Chưa có Voucher nào trong ví.</div>`;

    walletModal.classList.add('active');
  }

  document.getElementById('btnContraPickChar').addEventListener('click', openCharPicker);
  document.getElementById('btnContraWallet').addEventListener('click', openWalletModal);
  document.getElementById('btnOverOpenWallet').addEventListener('click', openWalletModal);

  document.querySelectorAll('.c-close').forEach((b) => {
    b.addEventListener('click', () => {
      document.getElementById(b.dataset.close).classList.remove('active');
    });
  });

  // Boot Engine
  resize();
  updateMetaHUD();
  syncAIBarUI();

  if (isDemoAI) {
    startNewCampaign(true);
  } else {
    buildStage(1);
    gameState = 'START';
  }
  requestAnimationFrame(loop);
})();
