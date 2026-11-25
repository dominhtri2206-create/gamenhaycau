// AI Auto-Pilot & Live Showcase Controller for index2.html
(() => {
  'use strict';

  const aiConfig = {
    enabled: true,
    showLaser: true,
    autoCycleSkin: true,
    autoStopAtPlatinum: false
  };

  let lastSkinSwapScore = 0;
  let readyWaitTicks = 0;
  let debugAim = null;

  // Exact frame-by-frame trajectory check: if we flap right now, will the upward arc hit any top pipe?
  function isFlapSafeFromTop(bird, pipes, params, playHeight, safetyMargin) {
    const speed = params.speed;
    const grav = params.gravity || 0.44;
    const impulse = params.flapImpulse || -8.1;
    const maxFall = params.maxFall || 11.5;
    const hitR = bird.radius - (playHeight < 430 ? 2 : 3);
    let y = bird.y;
    let vy = impulse;

    for (let t = 1; t <= 26; t++) {
      vy = Math.min(maxFall, vy + grav);
      y += vy;

      if (y - bird.radius < 2) return false;

      for (let i = 0; i < pipes.length; i++) {
        const p = pipes[i];
        const px = p.x - speed * t;
        if (px > bird.x + hitR + 4) break;
        if (px + p.width < bird.x - hitR) continue;

        const topH = p.isMoving
          ? p.baseTop + Math.sin(p.movePhase + 0.035 * t) * p.moveAmp
          : p.topHeight;

        if (y - hitR <= topH + safetyMargin) {
          return false;
        }
      }
      if (vy > 2.5) break;
    }
    return true;
  }

  // Exact frame-by-frame check: if we wait 1 frame and only flap NEXT frame, would we clip a bottom pipe or floor?
  function wouldWaitClipBottom(bird, pipes, params, playHeight, safetyMargin) {
    const speed = params.speed;
    const grav = params.gravity || 0.44;
    const impulse = params.flapImpulse || -8.1;
    const maxFall = params.maxFall || 11.5;
    const hitR = bird.radius - (playHeight < 430 ? 2 : 3);
    let vy = Math.min(maxFall, bird.vy + grav);
    let y = bird.y + vy;

    if (y + bird.radius >= playHeight - 4) return true;

    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];
      const px = p.x - speed;
      if (bird.x + hitR > px && bird.x - hitR < px + p.width) {
        const topH = p.isMoving
          ? p.baseTop + Math.sin(p.movePhase + 0.035) * p.moveAmp
          : p.topHeight;
        if (y + hitR >= topH + p.gap - safetyMargin) return true;
      }
    }

    vy = impulse;
    for (let t = 2; t <= 10; t++) {
      vy = Math.min(maxFall, vy + grav);
      y += vy;
      if (y + bird.radius >= playHeight - 4) return true;

      for (let i = 0; i < pipes.length; i++) {
        const p = pipes[i];
        const px = p.x - speed * t;
        if (bird.x + hitR > px && bird.x - hitR < px + p.width) {
          const topH = p.isMoving
            ? p.baseTop + Math.sin(p.movePhase + 0.035 * t) * p.moveAmp
            : p.topHeight;
          if (y + hitR >= topH + p.gap - safetyMargin) return true;
        }
      }
    }
    return false;
  }

  // Deterministic AI decision function (shared with headless verification)
  function computeAIDecision(state) {
    const { bird, pipes, params, viewHeight, groundHeight } = state;
    const playHeight = viewHeight - groundHeight;
    const hitRadius = bird.radius - (playHeight < 430 ? 2 : 3);
    const speed = params.speed;

    const targetIdx = pipes.findIndex((p) => p.x + p.width >= bird.x - hitRadius - 2);
    const targetPipe = targetIdx >= 0 ? pipes[targetIdx] : null;
    const nextPipe = targetIdx >= 0 && targetIdx + 1 < pipes.length ? pipes[targetIdx + 1] : null;

    if (!targetPipe) {
      const cruiseY = playHeight * 0.48;
      const flapTriggerY = cruiseY + 28;
      const shouldFlap = bird.y + bird.vy >= flapTriggerY && bird.vy >= -1.5;
      return {
        shouldFlap,
        targetX: bird.x + 120,
        targetY: cruiseY,
        flapTriggerY,
        targetPipe: null
      };
    }

    const tEnter = Math.max(0, (targetPipe.x - (bird.x + hitRadius)) / speed);
    const tExit = Math.max(0, (targetPipe.x + targetPipe.width - (bird.x - hitRadius)) / speed);
    const tMid = (tEnter + tExit) * 0.5;

    let aimPipe = targetPipe;
    let aimTime = tMid;
    if (nextPipe && tEnter === 0 && tExit <= 6) {
      const nextMid = ((nextPipe.x - bird.x) + nextPipe.width * 0.5) / speed;
      const nextTop = nextPipe.isMoving
        ? nextPipe.baseTop + Math.sin(nextPipe.movePhase + 0.035 * nextMid) * nextPipe.moveAmp
        : nextPipe.topHeight;
      const curTop = targetPipe.isMoving
        ? targetPipe.baseTop + Math.sin(targetPipe.movePhase + 0.035 * tExit) * targetPipe.moveAmp
        : targetPipe.topHeight;
      if (nextTop > curTop + 55) {
        aimPipe = nextPipe;
        aimTime = nextMid;
      }
    }

    const predTop = aimPipe.isMoving
      ? aimPipe.baseTop + Math.sin(aimPipe.movePhase + 0.035 * aimTime) * aimPipe.moveAmp
      : aimPipe.topHeight;
    const gap = aimPipe.gap;
    const predCenterY = predTop + gap * 0.5;

    const idealTriggerY = predTop + gap - Math.min(24, gap * 0.2);

    const topSafeStrict = isFlapSafeFromTop(bird, pipes, params, playHeight, 4.0);
    const topSafeEmergency = isFlapSafeFromTop(bird, pipes, params, playHeight, 0.8);
    const urgentBottom = wouldWaitClipBottom(bird, pipes, params, playHeight, 5.0);

    let shouldFlap = false;

    if (urgentBottom && topSafeEmergency) {
      shouldFlap = true;
    } else if (bird.y > idealTriggerY + 24 && bird.vy >= -3.8 && topSafeStrict) {
      // Steep climb to reach high upcoming pipe
      shouldFlap = true;
    } else if (bird.y + bird.vy >= idealTriggerY && bird.vy >= -1.2 && topSafeStrict) {
      // Smooth cruise through gap
      shouldFlap = true;
    }

    return {
      shouldFlap,
      targetX: Math.max(bird.x + 24, targetPipe.x + targetPipe.width * 0.5),
      targetY: predCenterY,
      flapTriggerY: idealTriggerY,
      targetPipe
    };
  }

  // Expose pure algorithm for automated stress tests if run in Node
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeAIDecision };
    return;
  }

  // Hook into game.js loop
  window.__neonFlapHooks = {
    onBeforeStep(api) {
      const state = api.getState();

      // Auto-launch from MENU or READY when AI is enabled
      if (aiConfig.enabled) {
        if (state.gameState === 'MENU') {
          api.startReady();
          readyWaitTicks = 0;
          return;
        }
        if (state.gameState === 'READY') {
          readyWaitTicks++;
          if (readyWaitTicks >= 18) {
            api.flap();
            readyWaitTicks = 0;
          }
          return;
        }
      }

      if (state.gameState !== 'PLAYING') {
        debugAim = null;
        return;
      }

      // Optional auto-cycle skin every 10 points so viewer sees all 3 characters in action
      if (aiConfig.autoCycleSkin && state.score > 0 && state.score % 10 === 0 && state.score !== lastSkinSwapScore) {
        lastSkinSwapScore = state.score;
        const skins = state.skins;
        const idx = skins.findIndex((s) => s.id === state.currentSkinId);
        const nextSkin = skins[(idx + 1) % skins.length];
        api.setSkin(nextSkin.id);
        api.showToast(`✨ Đổi nhân vật: ${nextSkin.name}`, nextSkin.desc);
      }

      // Optional auto-stop at 105 points (Platinum Medal + all Vouchers unlocked)
      if (aiConfig.autoStopAtPlatinum && state.score >= 105) {
        aiConfig.autoStopAtPlatinum = false;
        const btnStop = document.getElementById('btnAutoStop100');
        if (btnStop) btnStop.classList.remove('active');
        api.forceGameOver();
        return;
      }

      const decision = computeAIDecision(state);
      debugAim = decision;

      if (aiConfig.enabled && decision.shouldFlap) {
        api.flap();
      }

      updateTelemetryUI(state);
    },

    onRender(ctx, state) {
      if (!aiConfig.showLaser || !debugAim || state.gameState !== 'PLAYING') return;

      const { bird } = state;
      ctx.save();

      // Dashed AI trajectory / target sightline
      ctx.strokeStyle = aiConfig.enabled ? 'rgba(0, 245, 212, 0.65)' : 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(bird.x + 16, bird.y);
      ctx.lineTo(debugAim.targetX, debugAim.targetY);
      ctx.stroke();

      // Target reticle at predicted gap center
      ctx.setLineDash([]);
      ctx.strokeStyle = '#00f5d4';
      ctx.fillStyle = 'rgba(0, 245, 212, 0.2)';
      ctx.beginPath();
      ctx.arc(debugAim.targetX, debugAim.targetY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Subtle horizontal trigger line showing exact flap threshold
      ctx.strokeStyle = 'rgba(255, 42, 133, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bird.x - 18, debugAim.flapTriggerY);
      ctx.lineTo(bird.x + 26, debugAim.flapTriggerY);
      ctx.stroke();

      ctx.restore();
    }
  };

  function updateTelemetryUI(state) {
    const telSpeed = document.getElementById('telSpeed');
    const telGap = document.getElementById('telGap');
    const telNextGoal = document.getElementById('telNextGoal');
    if (!telSpeed) return;

    telSpeed.textContent = state.params.speed.toFixed(2);
    telGap.textContent = `${Math.round(state.params.gap)}px`;

    const s = state.score;
    let nextText = '💎 Đã Phá Đảo Bạch Kim!';
    if (s < 10) nextText = `${10 - s}đ nữa → 🥉 Đồng + Voucher 1`;
    else if (s < 15) nextText = `${15 - s}đ nữa → ☀️ Chuyển sang Ngày`;
    else if (s < 20) nextText = `${20 - s}đ nữa → 🔥 Ống di chuyển`;
    else if (s < 25) nextText = `${25 - s}đ nữa → 🥈 Bạc + Voucher 2`;
    else if (s < 50) nextText = `${50 - s}đ nữa → 🥇 Vàng + Voucher 3`;
    else if (s < 80) nextText = `${80 - s}đ nữa → 🎁 Voucher 4 tối đa`;
    else if (s < 100) nextText = `${100 - s}đ nữa → 💎 Bạch Kim`;

    telNextGoal.textContent = nextText;
  }

  // Bind Dock UI Controls once DOM is ready
  window.addEventListener('DOMContentLoaded', () => {
    const aiStatusPill = document.getElementById('aiStatusPill');
    const aiStatusText = document.getElementById('aiStatusText');
    const btnToggleAI = document.getElementById('btnToggleAI');
    const btnToggleLaser = document.getElementById('btnToggleLaser');
    const btnAutoSkin = document.getElementById('btnAutoSkin');
    const btnAutoStop100 = document.getElementById('btnAutoStop100');
    const btnTriggerEnd = document.getElementById('btnTriggerEnd');

    // Unlock Web Audio on first click anywhere on page
    window.addEventListener(
      'pointerdown',
      () => {
        if (window.soundFX) window.soundFX.init();
      },
      { once: true }
    );

    document.querySelectorAll('.speed-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const spd = Number(btn.dataset.speed) || 1;
        if (window.__neonFlapAPI) window.__neonFlapAPI.setSimSpeed(spd);
        document.querySelectorAll('.speed-btn').forEach((b) => b.classList.toggle('active', b === btn));
        if (window.soundFX) window.soundFX.click();
      });
    });

    btnToggleAI.addEventListener('click', () => {
      aiConfig.enabled = !aiConfig.enabled;
      btnToggleAI.classList.toggle('active', aiConfig.enabled);
      aiStatusPill.classList.toggle('paused', !aiConfig.enabled);
      aiStatusText.textContent = aiConfig.enabled
        ? 'AI AUTO-PILOT: ĐANG PHÁ ĐẢO'
        : 'AI TẠM DỪNG — BẠN ĐANG TỰ LÁI';
      if (window.soundFX) window.soundFX.click();
    });

    btnToggleLaser.addEventListener('click', () => {
      aiConfig.showLaser = !aiConfig.showLaser;
      btnToggleLaser.classList.toggle('active', aiConfig.showLaser);
      if (window.soundFX) window.soundFX.click();
    });

    btnAutoSkin.addEventListener('click', () => {
      aiConfig.autoCycleSkin = !aiConfig.autoCycleSkin;
      btnAutoSkin.classList.toggle('active', aiConfig.autoCycleSkin);
      if (window.soundFX) window.soundFX.click();
    });

    btnAutoStop100.addEventListener('click', () => {
      aiConfig.autoStopAtPlatinum = !aiConfig.autoStopAtPlatinum;
      btnAutoStop100.classList.toggle('active', aiConfig.autoStopAtPlatinum);
      if (window.soundFX) window.soundFX.click();
      if (aiConfig.autoStopAtPlatinum && window.__neonFlapAPI) {
        window.__neonFlapAPI.showToast('🏁 Đã hẹn mốc dừng', 'Sẽ tự mở bảng Tổng Kết khi đạt 105 điểm (Bạch Kim)!');
      }
    });

    btnTriggerEnd.addEventListener('click', () => {
      if (window.__neonFlapAPI) {
        window.__neonFlapAPI.forceGameOver();
      }
    });

    // When clicking "CHO AI BAY TIẾP" on Game Over screen, ensure AI is enabled
    const btnRestart = document.getElementById('btnRestart');
    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        aiConfig.enabled = true;
        lastSkinSwapScore = 0;
        btnToggleAI.classList.add('active');
        aiStatusPill.classList.remove('paused');
        aiStatusText.textContent = 'AI AUTO-PILOT: ĐANG PHÁ ĐẢO';
      });
    }
  });
})();
