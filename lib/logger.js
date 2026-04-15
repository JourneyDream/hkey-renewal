const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

function log(level, ...args) {
  if (LOG_LEVELS[level] >= currentLevel) {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const prefix = `[${ts}] [${level.toUpperCase()}]`;
    console.log(prefix, ...args);
  }
}

module.exports = {
  debug: (...a) => log('debug', ...a),
  info: (...a) => log('info', ...a),
  warn: (...a) => log('warn', ...a),
  error: (...a) => log('error', ...a),
};
