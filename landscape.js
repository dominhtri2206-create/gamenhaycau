// Shared Mobile Landscape Manager
// Automatically renders games horizontally on phones even when OS Portrait Lock is enabled!
(() => {
  'use strict';

  let forcedRotate = false;
  let gameW = window.innerWidth;
  let gameH = window.innerHeight;
  let hintShown = false;

  function isMobileOrTablet() {
    const shortSide = Math.min(window.innerWidth, window.innerHeight);
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return shortSide <= 920 && (hasTouch || window.innerWidth <= 920);
  }

  function updateLayout() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mobile = isMobileOrTablet();

    // If on a phone/tablet currently held in portrait (vw < vh), auto-rotate container 90deg into landscape!
    forcedRotate = mobile && vw < vh;

    if (forcedRotate) {
      gameW = vh;
      gameH = vw;
      document.body.classList.add('force-landscape');
      document.documentElement.style.setProperty('--landscape-w', `${vh}px`);
      document.documentElement.style.setProperty('--landscape-h', `${vw}px`);
      showRotateHintOnce();
    } else {
      gameW = vw;
      gameH = vh;
      document.body.classList.remove('force-landscape');
      document.documentElement.style.removeProperty('--landscape-w');
      document.documentElement.style.removeProperty('--landscape-h');
    }

    document.body.classList.toggle('compact-landscape', gameH <= 480);
  }

  function showRotateHintOnce() {
    if (hintShown) return;
    hintShown = true;
    const root = document.getElementById('app') || document.getElementById('contraApp');
    if (!root) return;
    const pill = document.createElement('div');
    pill.className = 'landscape-hint-pill';
    pill.textContent = '📱 Cầm ngang điện thoại để trải nghiệm toàn màn hình!';
    root.appendChild(pill);
    setTimeout(() => pill.classList.add('hide'), 2800);
    setTimeout(() => pill.remove(), 3300);
  }

  function getViewport() {
    updateLayout();
    return { width: gameW, height: gameH, rotated: forcedRotate };
  }

  function toGamePoint(clientX, clientY) {
    if (!forcedRotate) {
      return { x: clientX, y: clientY };
    }
    return {
      x: clientY,
      y: window.innerWidth - clientX
    };
  }

  function toGameDelta(dxScreen, dyScreen) {
    if (!forcedRotate) {
      return { dx: dxScreen, dy: dyScreen };
    }
    return {
      dx: dyScreen,
      dy: -dxScreen
    };
  }

  function tryNativeLandscape() {
    if (!isMobileOrTablet()) return;
    if (screen.orientation && typeof screen.orientation.lock === 'function') {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }

  window.addEventListener('resize', updateLayout);
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      updateLayout();
      window.dispatchEvent(new Event('resize'));
    }, 100);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateLayout);
  }

  window.addEventListener('DOMContentLoaded', () => {
    updateLayout();
    window.addEventListener('pointerdown', tryNativeLandscape, { once: true });
  });

  window.MobileLandscape = {
    getViewport,
    toGamePoint,
    toGameDelta,
    tryNativeLandscape,
    isForcedRotate: () => forcedRotate
  };
})();
