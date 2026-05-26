const TOKEN_KEY = "erp_token";
const USER_KEY = "erp_user";

function hydrateTabSessionFromRemembered() {
  if (sessionStorage.getItem(TOKEN_KEY)) return;

  const rememberedToken = localStorage.getItem(TOKEN_KEY);
  const rememberedUser = localStorage.getItem(USER_KEY);
  if (!rememberedToken) return;

  sessionStorage.setItem(TOKEN_KEY, rememberedToken);
  if (rememberedUser) sessionStorage.setItem(USER_KEY, rememberedUser);
}

export function getAuthToken() {
  hydrateTabSessionFromRemembered();
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getSessionUser(fallback = null) {
  try {
    hydrateTabSessionFromRemembered();
    const savedUser = sessionStorage.getItem(USER_KEY);
    return savedUser ? JSON.parse(savedUser) : fallback;
  } catch {
    return fallback;
  }
}

export function setActiveSession(token, user, remember = true) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));

  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function updateActiveUser(user) {
  const serialized = JSON.stringify(user);
  const activeToken = sessionStorage.getItem(TOKEN_KEY);

  sessionStorage.setItem(USER_KEY, serialized);

  if (!activeToken || localStorage.getItem(TOKEN_KEY) === activeToken) {
    localStorage.setItem(USER_KEY, serialized);
  }
}

export function clearActiveSession() {
  const activeToken = sessionStorage.getItem(TOKEN_KEY);
  const rememberedToken = localStorage.getItem(TOKEN_KEY);

  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);

  if (!activeToken || activeToken === rememberedToken) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

export function hasActiveSession() {
  return Boolean(getAuthToken());
}
