"use client";

import { CSRF_COOKIE, CSRF_HEADER, readCookieValue } from "./csrf";

function getCsrfToken() {
  return readCookieValue(document.cookie, CSRF_COOKIE);
}

export function withCsrfHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const token = getCsrfToken();
  if (token) {
    nextHeaders.set(CSRF_HEADER, token);
  }
  return nextHeaders;
}

export function fetchWithCsrf(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    headers: withCsrfHeaders(init.headers),
  });
}

