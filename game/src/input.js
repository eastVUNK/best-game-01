// Keyboard and mouse input, read once per frame. Movement is a unit vector
// from WASD or the arrow keys; the mouse aims; holding the mouse (or Space)
// fires; Shift dashes. Edge-triggered actions (confirm, pause, mute, restart,
// upgrade choices 1-3) are consumed with takeActions().

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;
export const ACTION_DASH = 16;
export const ACTION_UPGRADE_1 = 32;
export const ACTION_UPGRADE_2 = 64;
export const ACTION_UPGRADE_3 = 128;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'fire',
  ShiftLeft: 'dash', ShiftRight: 'dash',
  Enter: 'confirm',
  KeyP: 'pause', Escape: 'pause',
  KeyM: 'mute',
  KeyR: 'restart',
  Digit1: 'up1', Numpad1: 'up1',
  Digit2: 'up2', Numpad2: 'up2',
  Digit3: 'up3', Numpad3: 'up3',
};

export function createInput(canvas) {
  const keys = new Set();
  let queued = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let mouseIn = false;

  function onKeyDown(event) {
    const name = KEYMAP[event.code];
    if (!name) return;
    event.preventDefault();
    if (event.repeat) return;
    keys.add(name);
    if (name === 'confirm') queued |= ACTION_CONFIRM;
    else if (name === 'pause') queued |= ACTION_PAUSE;
    else if (name === 'mute') queued |= ACTION_MUTE;
    else if (name === 'restart') queued |= ACTION_RESTART;
    else if (name === 'dash') queued |= ACTION_DASH;
    else if (name === 'up1') queued |= ACTION_UPGRADE_1;
    else if (name === 'up2') queued |= ACTION_UPGRADE_2;
    else if (name === 'up3') queued |= ACTION_UPGRADE_3;
  }

  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (name) keys.delete(name);
  }

  function trackMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseIn = true;
  }

  canvas.addEventListener('mousemove', trackMouse);
  canvas.addEventListener('mousedown', (event) => {
    trackMouse(event);
    if (event.button === 0) {
      mouseDown = true;
      mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('mouseleave', () => { mouseIn = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => keys.clear());

  return {
    /** Unit movement vector from the held keys (0, 0 when still). */
    move() {
      let x = 0;
      let y = 0;
      if (keys.has('left')) x -= 1;
      if (keys.has('right')) x += 1;
      if (keys.has('up')) y -= 1;
      if (keys.has('down')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    get firing() {
      return mouseDown || keys.has('fire');
    },
    /** Aim point in canvas CSS pixels (scaled to the field by the caller). */
    aim() {
      return { x: mouseX, y: mouseY, inside: mouseIn };
    },
    /** True once for a fresh left click; consumed on read. */
    get clicked() {
      const was = mouseClicked;
      mouseClicked = false;
      return was;
    },
    /** Edge-triggered actions since the last call; consumed on read. */
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
  };
}
