const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return;
      const key = trimmed.slice(0, eqIndex).trim();
      let val = trimmed.slice(eqIndex + 1).trim();
      if (/^["']/.test(val) && val[0] === val[val.length - 1]) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    });
}

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];
required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
});

module.exports = {
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'marvel_card_game',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  port: parseInt(process.env.PORT, 10) || 3000,
  clientOrigin: process.env.CLIENT_ORIGIN || `http://localhost:${process.env.PORT || 3000}`,
};
