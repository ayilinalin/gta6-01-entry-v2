// NEON TIDE v2 — keyboard + mouse. One shared input state, read by the sim.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    keys, mouseX: 0, mouseY: 0, mouseDown: false,
    pressed: new Set(), // keys pressed since last sim step (edge-triggered)
    anyKey: false,
  };

  function codeOf(e) { return e.code || e.key || ''; }

  window.addEventListener('keydown', (e) => {
    const c = codeOf(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
    if (!keys.has(c)) input.pressed.add(c);
    keys.add(c);
    input.anyKey = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(codeOf(e)));
  window.addEventListener('blur', () => { keys.clear(); input.mouseDown = false; });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.mouseDown = true;
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  input.consumePressed = function consumePressed(c) {
    if (input.pressed.has(c)) { input.pressed.delete(c); return true; }
    return false;
  };
  input.clearPressed = function clearPressed() { input.pressed.clear(); };
  input.down = function down(...codes) { return codes.some((c) => keys.has(c)); };
  return input;
}
