import { defaultConfig } from "@/lib/defaults";
import { toPublicConfig, type PublicConfig } from "@/lib/public-config";
import type { BannerConfig, Property } from "@/lib/types";

/** Happy-dom settings shared by the SDK tests: run inline scripts, never fetch scripts or frames. */
export const SITE = "https://shop.example/";

/** A published config as the SDK receives it, from the real defaults. */
export function publicConfig(edit: (c: BannerConfig) => void = () => {}): PublicConfig {
  const config = defaultConfig("shop.example");
  edit(config);
  return toPublicConfig({ siteKey: "pk_test", config, trackers: [] } as unknown as Property);
}
