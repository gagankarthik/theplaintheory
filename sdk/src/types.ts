import type { PublicConfig } from "../../src/lib/public-config";
import type { CategoryId, Framework, NoticeTranslation, RegionRule } from "../../src/lib/types";

export type { PublicConfig, CategoryId, Framework, NoticeTranslation, RegionRule };
export type Cats = Record<CategoryId, boolean>;
export type Action = "accept_all" | "reject_all" | "custom" | "revoke";

/** What the SDK persists in the plain_consent cookie. Short keys keep the cookie small. */
export interface Stored {
  /** config version the choice was made against */
  v: number;
  f: Framework;
  c: Cats;
  /** epoch ms */
  t: number;
  /** random visitor id, never derived from PII */
  id: string;
  /** epoch ms of a "reject all"; suppresses re-asking for the configured period */
  r?: number;
  /** language the visitor chose in the picker */
  l?: string;
}

export interface ConsentState {
  framework: Framework;
  categories: Cats;
  decided: boolean;
  visitorId: string;
  /** language the notice is shown in */
  language: string;
}
