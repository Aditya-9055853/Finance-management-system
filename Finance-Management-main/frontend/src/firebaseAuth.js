const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
const identityToolkitUrl = 'https://identitytoolkit.googleapis.com/v1/accounts'

function requireFirebaseConfig() {
  if (!apiKey) throw new Error('Firebase is not configured yet. Add VITE_FIREBASE_API_KEY in Render and rebuild.')
}

async function firebaseRequest(method, body) {
  requireFirebaseConfig()
  const response = await fetch(`${identityToolkitUrl}:${method}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const code = data?.error?.message || ''
    const messages = {
      EMAIL_EXISTS: 'An account with this email already exists. Sign in instead.',
      EMAIL_NOT_FOUND: 'No account was found for this email.',
      INVALID_PASSWORD: 'The email or password is incorrect.',
      INVALID_LOGIN_CREDENTIALS: 'The email or password is incorrect.',
      USER_DISABLED: 'This account has been disabled.',
      WEAK_PASSWORD: 'Choose a password with at least 8 characters.',
      OPERATION_NOT_ALLOWED: 'Enable Email/Password sign-in in the Firebase console first.',
      TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Wait a little and try again.',
      INVALID_EMAIL: 'Enter a valid email address.',
    }
    throw new Error(messages[code] || 'Firebase could not complete that request. Check the Firebase project settings and try again.')
  }
  return data
}

export function createFirebaseAccount(email, password, name) {
  return firebaseRequest('signUp', { email, password, returnSecureToken: true })
    .then(async account => {
      const updated = await firebaseRequest('update', {
        idToken: account.idToken,
        displayName: name,
        returnSecureToken: true,
      })
      return { ...account, ...updated }
    })
}

export function signInWithFirebase(email, password) {
  return firebaseRequest('signInWithPassword', { email, password, returnSecureToken: true })
}

export function sendFirebaseVerification(idToken) {
  return firebaseRequest('sendOobCode', {
    requestType: 'VERIFY_EMAIL',
    idToken,
    continueUrl: window.location.origin,
  })
}

export async function getFirebaseEmailVerified(idToken) {
  const data = await firebaseRequest('lookup', { idToken })
  return Boolean(data.users?.[0]?.emailVerified)
}

export async function openFinTrackSession(idToken) {
  const response = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ idToken }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Could not start your FinTrack session.')
  return data.user
}
