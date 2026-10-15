import spdxLicenses from "spdx-license-list";

/**
 * GitHub's `spdx_id` when it found a license it couldn't identify ("Other").
 * https://docs.github.com/en/rest/licenses
 */
export const UNIDENTIFIED_LICENSE = "NOASSERTION";

export type LicenseStatus = "osi_approved" | "not_osi_approved" | "unknown" | "none";

/** What a repository's license (GitHub's SPDX identifier) means for counting (PLAN.md §4.1). */
export function licenseStatus(spdxId: string | null | undefined): LicenseStatus {
  if (!spdxId) return "none";
  if (spdxId === UNIDENTIFIED_LICENSE) return "unknown";
  const license = spdxLicenses[spdxId];
  if (!license) return "unknown";
  return license.osiApproved ? "osi_approved" : "not_osi_approved";
}
