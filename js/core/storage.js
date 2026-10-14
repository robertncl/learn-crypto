/* localStorage can throw (blocked site data, some private modes). Every access goes
   through these helpers so a storage failure only loses persistence, never the page. */

export function readString(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* persistence unavailable — the in-memory state still works */
  }
}

export function readJSON(key, fallback) {
  try {
    return JSON.parse(readString(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export const writeJSON = (key, value) => writeString(key, JSON.stringify(value));
