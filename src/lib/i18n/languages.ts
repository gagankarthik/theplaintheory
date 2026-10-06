import type { LanguageCode } from "../types";

export interface LanguageInfo {
  code: LanguageCode;
  /** English name */
  name: string;
  /** name in the language itself */
  native: string;
  /** writing direction */
  dir: "ltr" | "rtl";
  /** one of the 22 languages in the Eighth Schedule to the Constitution of India (DPDP Act s.5(3)) */
  eighthSchedule: boolean;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: "en", name: "English", native: "English", dir: "ltr", eighthSchedule: false },
  { code: "as", name: "Assamese", native: "অসমীয়া", dir: "ltr", eighthSchedule: true },
  { code: "bn", name: "Bengali", native: "বাংলা", dir: "ltr", eighthSchedule: true },
  { code: "brx", name: "Bodo", native: "बड़ो", dir: "ltr", eighthSchedule: true },
  { code: "doi", name: "Dogri", native: "डोगरी", dir: "ltr", eighthSchedule: true },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", dir: "ltr", eighthSchedule: true },
  { code: "hi", name: "Hindi", native: "हिन्दी", dir: "ltr", eighthSchedule: true },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", dir: "ltr", eighthSchedule: true },
  { code: "ks", name: "Kashmiri", native: "کٲشُر", dir: "rtl", eighthSchedule: true },
  { code: "kok", name: "Konkani", native: "कोंकणी", dir: "ltr", eighthSchedule: true },
  { code: "mai", name: "Maithili", native: "मैथिली", dir: "ltr", eighthSchedule: true },
  { code: "ml", name: "Malayalam", native: "മലയാളം", dir: "ltr", eighthSchedule: true },
  { code: "mni", name: "Manipuri", native: "মৈতৈলোন্", dir: "ltr", eighthSchedule: true },
  { code: "mr", name: "Marathi", native: "मराठी", dir: "ltr", eighthSchedule: true },
  { code: "ne", name: "Nepali", native: "नेपाली", dir: "ltr", eighthSchedule: true },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ", dir: "ltr", eighthSchedule: true },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", dir: "ltr", eighthSchedule: true },
  { code: "sa", name: "Sanskrit", native: "संस्कृतम्", dir: "ltr", eighthSchedule: true },
  { code: "sat", name: "Santali", native: "संताली", dir: "ltr", eighthSchedule: true },
  { code: "sd", name: "Sindhi", native: "سنڌي", dir: "rtl", eighthSchedule: true },
  { code: "ta", name: "Tamil", native: "தமிழ்", dir: "ltr", eighthSchedule: true },
  { code: "te", name: "Telugu", native: "తెలుగు", dir: "ltr", eighthSchedule: true },
  { code: "ur", name: "Urdu", native: "اردو", dir: "rtl", eighthSchedule: true },
  { code: "de", name: "German", native: "Deutsch", dir: "ltr", eighthSchedule: false },
  { code: "fr", name: "French", native: "Français", dir: "ltr", eighthSchedule: false },
  { code: "es", name: "Spanish", native: "Español", dir: "ltr", eighthSchedule: false },
  { code: "it", name: "Italian", native: "Italiano", dir: "ltr", eighthSchedule: false },
  { code: "nl", name: "Dutch", native: "Nederlands", dir: "ltr", eighthSchedule: false },
  { code: "pt", name: "Portuguese", native: "Português", dir: "ltr", eighthSchedule: false },
];

export const EIGHTH_SCHEDULE = LANGUAGES.filter((l) => l.eighthSchedule);

export const languageInfo = (code: string) => LANGUAGES.find((l) => l.code === code);

export const isLanguageCode = (code: string): code is LanguageCode => LANGUAGES.some((l) => l.code === code);

/** Plans without `indianLanguages` may still use English and Hindi. */
export const FREE_LANGUAGES: LanguageCode[] = ["en", "hi"];
