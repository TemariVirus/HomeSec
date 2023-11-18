import { get, writable } from "svelte/store";
import Cookies from "js-cookie";

const AUTH_COOKIE_NAME = "HomeSec-login-JWT";

const authStore = writable(null as string | null);

export function getAuthToken() {
    authStore.set(Cookies.get(AUTH_COOKIE_NAME) ?? null);
    return get(authStore);
}

export function setAuthToken(token: string) {
    authStore.set(token);
    Cookies.set(AUTH_COOKIE_NAME, token, {
        expires: 7,
        sameSite: "strict",
        secure: true,
    });
}

export function clearAuthToken() {
    authStore.set(null);
    Cookies.remove(AUTH_COOKIE_NAME);
}
