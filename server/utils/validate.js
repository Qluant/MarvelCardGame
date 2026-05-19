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

function validateUrl(value) {
  if (!value) return { valid: true }; // null or empty is allowed
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

function validateHeroId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    return { valid: false, message: 'Invalid heroId' };
  }
  return { valid: true };
}

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
