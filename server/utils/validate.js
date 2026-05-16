/**
 * utils/validate.js
 * Pure validation functions. Each returns { valid: Boolean, message: String }.
 * No side effects, no HTTP, no DB.
 */

/**
 * Nickname: 3–30 chars, alphanumeric + underscore + hyphen.
 * @param {*} value
 * @returns {{ valid: boolean, message: string }}
 */
function validateNickname(value) {
  if (!value || typeof value !== 'string') {
    return { valid: false, message: 'Nickname is required' };
  }
  const trimmed = value.trim();
  if (trimmed.length < 3) {
    return { valid: false, message: 'Nickname must be at least 3 characters' };
  }
  if (trimmed.length > 30) {
    return { valid: false, message: 'Nickname must be at most 30 characters' };
  }
  if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed)) {
    return { valid: false, message: 'Nickname contains invalid characters' };
  }
  return { valid: true };
}

/**
 * Password: 6–72 chars (72 is bcrypt's practical limit).
 * @param {*} value
 * @returns {{ valid: boolean, message: string }}
 */
function validatePassword(value) {
  if (!value || typeof value !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  if (value.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters' };
  }
  if (value.length > 72) {
    return { valid: false, message: 'Password must be at most 72 characters' };
  }
  return { valid: true };
}

/**
 * Avatar URL: null/empty is allowed (clears avatar).
 * If provided, must be a valid http/https URL.
 * @param {*} value
 * @returns {{ valid: boolean, message: string }}
 */
function validateUrl(value) {
  if (!value) return { valid: true }; // null or empty — allowed
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, message: 'URL must use http or https' };
    }
    return { valid: true };
  } catch {
    return { valid: false, message: 'Invalid URL format' };
  }
}

/**
 * Hero ID: integer >= 1.
 * @param {*} value
 * @returns {{ valid: boolean, message: string }}
 */
function validateHeroId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    return { valid: false, message: 'Invalid heroId' };
  }
  return { valid: true };
}

/**
 * Room name: non-empty string, 1–50 chars.
 * @param {*} value
 * @returns {{ valid: boolean, message: string }}
 */
function validateRoomName(value) {
  if (!value || typeof value !== 'string') {
    return { valid: false, message: 'Room name is required' };
  }
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 50) {
    return { valid: false, message: 'Room name must be 1–50 characters' };
  }
  return { valid: true };
}

module.exports = {
  validateNickname,
  validatePassword,
  validateUrl,
  validateHeroId,
  validateRoomName,
};
