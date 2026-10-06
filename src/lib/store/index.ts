import "server-only";
import type { Store } from "./types";

let store: Store | null = null;

/** STORE_DRIVER=dynamodb uses the AWS table; anything else uses the local file store. */
export async function getStore(): Promise<Store> {
  if (store) return store;
  if (process.env.STORE_DRIVER === "dynamodb") {
    store = (await import("./dynamo")).dynamoStore;
  } else {
    store = (await import("./local")).localStore;
  }
  return store;
}

export type { Store, ReceiptDraft, ReceiptQuery } from "./types";
