/**
 * SocioCheck AI - Security Module
 * Manages admin access, failed login lockout (5 attempts, 10 min lockout)
 */

const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 10 * 60 * 1000; // 10 minutes

export function getSecurityStatus() {
    const failedAttempts = parseInt(localStorage.getItem('admin_failed_attempts') || '0', 10);
    const lockoutTime = parseInt(localStorage.getItem('admin_lockout_time') || '0', 10);
    const now = Date.now();

    if (lockoutTime && now < lockoutTime + LOCKOUT_TIME_MS) {
        const remainingMs = (lockoutTime + LOCKOUT_TIME_MS) - now;
        return {
            locked: true,
            remainingMinutes: Math.ceil(remainingMs / 60000),
            remainingSeconds: Math.ceil(remainingMs / 1000)
        };
    }

    // Reset attempts if lockout period is over
    if (lockoutTime && now >= lockoutTime + LOCKOUT_TIME_MS) {
        resetLockout();
    }

    return {
        locked: false,
        failedAttempts
    };
}

export function registerFailedAttempt() {
    let failedAttempts = parseInt(localStorage.getItem('admin_failed_attempts') || '0', 10);
    failedAttempts += 1;
    localStorage.setItem('admin_failed_attempts', failedAttempts.toString());

    if (failedAttempts >= LOCKOUT_ATTEMPTS) {
        localStorage.setItem('admin_lockout_time', Date.now().toString());
        return { locked: true, remainingMinutes: 10 };
    }

    return { locked: false, failedAttempts };
}

export function resetLockout() {
    localStorage.removeItem('admin_failed_attempts');
    localStorage.removeItem('admin_lockout_time');
}

export function saveSessionToken(token) {
    localStorage.setItem('admin_session_token', token);
}

export function clearSessionToken() {
    localStorage.removeItem('admin_session_token');
}

export function getSessionToken() {
    return localStorage.getItem('admin_session_token');
}
