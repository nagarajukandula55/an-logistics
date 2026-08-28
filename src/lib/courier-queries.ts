import { prisma } from "@/lib/prisma";
import { CommissionType, CourierAgreementStatus, CourierPartnerStatus } from "@prisma/client";

/**
 * Shared ServiceArea lookups used by both the courier server actions
 * (src/lib/actions/couriers.ts) and the MANUAL provider adapter
 * (src/lib/courier-providers/manual-provider.ts) — kept in a plain module
 * (no "use server") so the provider adapter doesn't have to import from
 * the server-actions file and create a circular dependency.
 */

export async function findServiceableBranches(pincode: string) {
  if (!pincode) return [];

  return prisma.courierBranch.findMany({
    where: {
      isActive: true,
      courierPartner: { status: CourierPartnerStatus.ACTIVE },
      serviceAreas: { some: { pincode } },
    },
    include: { courierPartner: true },
    orderBy: { name: "asc" },
  });
}

export async function findServiceableBranchForPartner(courierPartnerId: string, pincode: string) {
  if (!pincode) return null;

  return prisma.courierBranch.findFirst({
    where: {
      courierPartnerId,
      isActive: true,
      courierPartner: { status: CourierPartnerStatus.ACTIVE },
      serviceAreas: { some: { pincode } },
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Computes the platform fee the marketplace takes on a courier-fulfilled
 * order, given the partner's (or active agreement's) commission terms and
 * a base value to apply it against. Shared by assignOrderToCourierAction
 * and getQuotesForOrder so there is exactly one commission calculation.
 */
export function computePlatformFee(
  commission: { commissionType: CommissionType; commissionValue: number },
  baseValue: number | null | undefined
): number | null {
  if (baseValue == null) return null;
  return commission.commissionType === CommissionType.PERCENT
    ? Math.round(baseValue * (commission.commissionValue / 100) * 100) / 100
    : commission.commissionValue;
}

/**
 * Resolves the effective commission terms for a partner: the partner's
 * currently-ACTIVE agreement takes precedence over the partner's own
 * defaults, per real onboarding/agreement lifecycle.
 */
export async function getEffectiveCommission(
  courierPartnerId: string,
  partnerDefaults: { commissionType: CommissionType; commissionValue: number }
) {
  const activeAgreement = await prisma.courierAgreement.findFirst({
    where: { courierPartnerId, status: CourierAgreementStatus.ACTIVE },
    orderBy: { effectiveFrom: "desc" },
  });
  return {
    commissionType: activeAgreement?.commissionType ?? partnerDefaults.commissionType,
    commissionValue: activeAgreement?.commissionValue ?? partnerDefaults.commissionValue,
  };
}
