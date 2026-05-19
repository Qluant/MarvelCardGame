const config = require('../env.json');

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];
required.forEach((key) => {
  if (!config[key]) {
    throw new Error(`Missing required config variable in env.json: ${key}`);
  }
});

module.exports = {
  db: {
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME || 'marvel_card_game',
  },
  jwt: {
    secret: config.JWT_SECRET,
  },
  port: parseInt(config.PORT, 10) || 3000,
  clientOrigin: config.CLIENT_ORIGIN || `http://localhost:${config.PORT || 3000}`,
};
