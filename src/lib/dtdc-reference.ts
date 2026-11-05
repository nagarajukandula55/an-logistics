import { COMPANY_PROFILE } from "@/lib/company-profile";

export const AN_LOGISTICS_DETAILS = COMPANY_PROFILE;

export const DTDC_SERVICE_RULES = {
  GST_RATE_PERCENT: 18,
  AIR_VOLUMETRIC_DIVISOR: 5000,
  SURFACE_VOLUMETRIC_DIVISOR: 4750,
  RTO_PRICING: "same as forwarding charges",
} as const;

export type DtdcServiceMode = "AIR" | "SURFACE";

export function getDtdcVolumetricDivisor(mode: DtdcServiceMode): number {
  return mode === "AIR" ? DTDC_SERVICE_RULES.AIR_VOLUMETRIC_DIVISOR : DTDC_SERVICE_RULES.SURFACE_VOLUMETRIC_DIVISOR;
}
