module.exports = {
  info: (...a) => console.log('[INFO]', ...a),
  warn: (...a) => console.warn('[WARN]', ...a),
  error: (...a) => console.error('[ERROR]', ...a),
  debug: (...a) => console.debug('[DEBUG]', ...a),
  // Shift event logger (compat shim)
  shift: (event, userId, message = '') => {
    try {
      console.log('[SHIFT]', String(event).toUpperCase(), '-', userId, '-', message);
    } catch (_) {
      console.log('[SHIFT]', event, userId, message);
    }
  }
};
