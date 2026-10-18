import { consentActions, consentStore, isAllowed, loadPlainConsent, loadScriptWhenAllowed, type Category, type ConsentState, type LoadOptions } from "@theplaintheory/consent";
import { computed, defineComponent, getCurrentScope, h, onScopeDispose, readonly, shallowRef, watch, type App, type ComputedRef, type PropType, type Ref } from "vue";

export type { Categories, Category, ConsentState, Framework, LoadOptions, PlainConsentApi } from "@theplaintheory/consent";
export { getConsent, isAllowed, loadPlainConsent, loadScriptWhenAllowed, onConsentChange, whenAllowed } from "@theplaintheory/consent";

/**
 * Vue plugin: loads plain-consent.js once in the browser. SSR-safe (Nuxt): does nothing on the server.
 *
 *   app.use(createPlainConsent({ siteKey: "pk_YOUR_SITE_KEY" }))
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
  /** open the preferences panel */
  open(): void;
  /** forget the choice and ask again */
  revoke(): void;
  /** show the notice in one of the site's languages; "" for the default */
  setLanguage(code: string): void;
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

/**
 * Add a third-party script once `category` is allowed. Renders nothing; deduplicated by `src` and
 * never removed (a later withdrawal applies from the next page view). Emits `load`.
 *
 *   <ConsentScript category="analytics" src="https://www.googletagmanager.com/gtag/js?id=G-XXXX" />
 */
export const ConsentScript = defineComponent({
  name: "ConsentScript",
  props: {
    category: { type: String as PropType<Category>, required: true },
    src: { type: String, required: true },
    attributes: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
  },
  emits: ["load"],
  setup(props, { emit }) {
    const { allowed } = useConsent();
    const on = allowed(props.category);
    if (typeof window !== "undefined") {
      watch(
        on,
        (yes) => {
          if (!yes) return;
          loadScriptWhenAllowed(props.category, props.src, props.attributes).then((s) => s.addEventListener("load", () => emit("load"), { once: true }));
        },
        { immediate: true },
      );
    }
    return () => null;
  },
});

/**
 * A button that reopens the preferences panel, so withdrawing is as easy as giving consent
 * (DPDPA, GDPR). Put it in your footer. Slot content replaces the default label.
 */
export const PrivacyChoicesButton = defineComponent({
  name: "PrivacyChoicesButton",
  setup(_props, { slots, attrs }) {
    return () => h("button", { type: "button", ...attrs, onClick: () => consentActions.open() }, slots.default?.() ?? "Privacy choices");
  },
});
