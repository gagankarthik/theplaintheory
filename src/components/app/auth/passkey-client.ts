"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * Whether this browser can use passkeys (WebAuthn). null during server rendering and hydration, so
 * callers can avoid a flash of the wrong option; then true or false.
 */
export function useWebAuthnSupport(): boolean | null {
  return useSyncExternalStore(
    noop,
    () => typeof window !== "undefined" && typeof window.PublicKeyCredential === "function",
    () => null,
  );
}

/** A plain-language message for a failed or cancelled browser passkey prompt. */
export function passkeyErrorMessage(e: unknown, ceremony: "create" | "get") {
  const name = e instanceof Error ? e.name : "";
  const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
  if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" || name === "InvalidStateError") return "That passkey is already on your account. Try a different device or security key.";
  if (name === "NotAllowedError" || name === "AbortError") return "The passkey prompt was closed or timed out. Try again when you're ready.";
  if (name === "SecurityError") return "This page's address can't use passkeys. Open Plain Theory at its usual address and try again.";
  return ceremony === "create" ? "Your browser couldn't create a passkey. Try again, or use an authenticator app." : "Your browser couldn't use a passkey. Try again, or use a code instead.";
}
