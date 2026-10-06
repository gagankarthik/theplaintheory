import {
  consentActions,
  consentStore,
  isAllowed,
  loadPlainConsent,
  type Category,
  type ConsentState,
  type LoadOptions,
} from "@plaintheory/consent";
import { computed, defineComponent, getCurrentScope, onScopeDispose, readonly, shallowRef, type App, type ComputedRef, type PropType, type Ref } from "vue";

export type { Categories, Category, ConsentState, Framework, LoadOptions, PlainConsentApi } from "@plaintheory/consent";
export { getConsent, loadPlainConsent, loadScriptWhenAllowed, whenAllowed } from "@plaintheory/consent";

/**
 * Vue plugin: loads plain-consent.js once in the browser. SSR-safe (Nuxt): does nothing on the server.
 *
 *   app.use(createPlainConsent({ siteKey: "pk_live_..." }))
 */
export function createPlainConsent(options: LoadOptions) {
  return {
    install(_app: App) {
      if (typeof window === "undefined") return;
      loadPlainConsent(options).catch((e: unknown) => console.warn(e));
    },
  };
}

export interface UseConsent {
  /** null on the server and until the script is ready */
  state: Readonly<Ref<ConsentState | null>>;
  ready: ComputedRef<boolean>;
  allowed(category: Category): ComputedRef<boolean>;
  acceptAll(): void;
  rejectAll(): void;
  set(partial: Partial<Record<Category, boolean>>): void;
  open(): void;
  revoke(): void;
}

/** Reactive consent state and actions. Unsubscribes automatically when the calling scope is disposed. */
export function useConsent(): UseConsent {
  const state = shallowRef<ConsentState | null>(consentStore.getSnapshot());
  if (typeof window !== "undefined") {
    const off = consentStore.subscribe(() => {
      state.value = consentStore.getSnapshot();
    });
    if (getCurrentScope()) onScopeDispose(off);
  }
  return {
    state: readonly(state),
    ready: computed(() => state.value !== null),
    allowed: (category) => computed(() => isAllowed(category, state.value)),
    ...consentActions,
  };
}

/**
 * Render the default slot only when `category` is allowed; otherwise the `fallback` slot.
 *
 *   <ConsentGate category="marketing"><YouTubeEmbed /><template #fallback>…</template></ConsentGate>
 */
export const ConsentGate = defineComponent({
  name: "ConsentGate",
  props: {
    category: { type: String as PropType<Category>, required: true },
  },
  setup(props, { slots }) {
    const { state } = useConsent();
    return () => (isAllowed(props.category, state.value) ? slots.default?.() : slots.fallback?.());
  },
});
