const crypto = require("node:crypto");

if (!global.crypto) {
  Object.defineProperty(global, "crypto", {
    value: crypto,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: crypto,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}
