const crypto = require("node:crypto");

if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = crypto.webcrypto || crypto;
}
