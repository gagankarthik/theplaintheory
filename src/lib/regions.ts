import type { Organization } from "./types";

export const DATA_REGIONS: { id: Organization["dataRegion"]; label: string; city: string }[] = [
  { id: "ap-south-1", label: "India: Mumbai (ap-south-1)", city: "Mumbai" },
  { id: "ap-south-2", label: "India: Hyderabad (ap-south-2)", city: "Hyderabad" },
  { id: "eu-central-1", label: "EU: Frankfurt (eu-central-1)", city: "Frankfurt" },
  { id: "us-east-1", label: "US: N. Virginia (us-east-1)", city: "N. Virginia" },
];

export const regionLabel = (id: Organization["dataRegion"]) => DATA_REGIONS.find((r) => r.id === id)?.label ?? id;
