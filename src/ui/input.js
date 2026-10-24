// Keyboard and mouse state. Edge-triggered presses are cleared once per frame by endFrame().
CS.Input = class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };
    this.mousePressed = false;
    this.rightPressed = false;
    this.wheel = 0;

    const blockDefault = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    window.addEventListener('keydown', e => {
      if (blockDefault.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });

    const toCanvas = e => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * canvas.width / r.width;
      this.mouse.y = (e.clientY - r.top) * canvas.height / r.height;
    };
    window.addEventListener('mousemove', toCanvas);
    canvas.addEventListener('mousedown', e => {
      toCanvas(e);
      if (e.button === 0) { this.mouse.down = true; this.mousePressed = true; }
      if (e.button === 2) this.rightPressed = true;
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.mouse.down = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.wheel += Math.sign(e.deltaY); }, { passive: false });
  }

  isDown(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }

  endFrame() {
    this.pressed.clear();
    this.mousePressed = false;
    this.rightPressed = false;
    this.wheel = 0;
  }
};
