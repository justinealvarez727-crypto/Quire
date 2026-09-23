import '@testing-library/jest-dom/vitest';

window.matchMedia = window.matchMedia || function () {
  return { matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
};
window.HTMLCanvasElement.prototype.getContext = () => ({ measureText: (t) => ({ width: t.length * 7 }), set font(v) {} });
Element.prototype.getBoundingClientRect = function () {
  return { left: 0, top: 0, width: 360, height: 500, right: 360, bottom: 500, x: 0, y: 0, toJSON(){} };
};
Element.prototype.setPointerCapture = () => {};
window.scrollTo = () => {};
