import "server-only";
import type { Store } from "./types";

let store: Store | null = null;

/**
 * STORE_DRIVER=dynamodb uses the AWS table; anything else uses the local file store. Production
 * never falls back to the local store: customer pages and the staff console must only ever show
 * real data, so a missing driver fails loudly instead of serving local test records.
 */
export async function getStore(): Promise<Store> {
  if (store) return store;
  if (process.env.VERCEL_ENV === "production" && process.env.STORE_DRIVER !== "dynamodb") {
    throw new Error("STORE_DRIVER must be dynamodb in production; refusing to use the local file store.");
  }
  if (process.env.STORE_DRIVER === "dynamodb") {
    store = (await import("./dynamo")).dynamoStore;
  } else {
    store = (await import("./local")).localStore;
  }
  return store;
}

export type { Store, ReceiptDraft, ReceiptQuery } from "./types";
