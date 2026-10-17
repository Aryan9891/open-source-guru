import { describe, expect, it } from "vitest";
import { classifyContribution, type RepoFacts, repoExclusion } from "./classify.ts";
import { licenseStatus } from "./licenses.ts";

const USER = 1001;
const openSource: RepoFacts = {
  isPrivate: false,
  isFork: false,
  ownerGithubId: 2002,
  licenseSpdxId: "MIT",
};

describe("licenseStatus", () => {
  it("accepts OSI-approved licenses", () => {
    for (const id of ["MIT", "Apache-2.0", "GPL-3.0", "MPL-2.0", "BSD-3-Clause", "Unlicense"]) {
      expect(licenseStatus(id)).toBe("osi_approved");
    }
  });

  it("tells licenses that aren't OSI-approved, unidentified and missing ones apart", () => {
    expect(licenseStatus("CC0-1.0")).toBe("not_osi_approved");
    expect(licenseStatus("CC-BY-4.0")).toBe("not_osi_approved");
    expect(licenseStatus("NOASSERTION")).toBe("unknown");
    expect(licenseStatus("Not-A-Real-License")).toBe("unknown");
    expect(licenseStatus(null)).toBe("none");
    expect(licenseStatus("")).toBe("none");
  });
});

describe("repoExclusion", () => {
  it("is null for a public, non-fork repository regardless of license", () => {
    expect(repoExclusion(openSource)).toBeNull();
    expect(repoExclusion({ ...openSource, licenseSpdxId: null })).toBeNull();
    expect(repoExclusion({ ...openSource, licenseSpdxId: "CC0-1.0" })).toBeNull();
    expect(repoExclusion({ ...openSource, licenseSpdxId: "NOASSERTION" })).toBeNull();
  });

  it("gives the reason otherwise", () => {
    expect(repoExclusion({ ...openSource, isPrivate: true })).toBe("private");
    expect(repoExclusion({ ...openSource, isFork: true })).toBe("fork");
  });
});

describe("classifyContribution", () => {
  it("counts contributions to someone else's open-source repository", () => {
    expect(classifyContribution(openSource, USER)).toEqual({
      counted: true,
      excludedReason: null,
    });
  });

  it("counts contributions to open-source repositories without a detected license (e.g. freeCodeCamp)", () => {
    expect(classifyContribution({ ...openSource, licenseSpdxId: null }, USER)).toEqual({
      counted: true,
      excludedReason: null,
    });
    expect(classifyContribution({ ...openSource, licenseSpdxId: "CC0-1.0" }, USER)).toEqual({
      counted: true,
      excludedReason: null,
    });
    expect(classifyContribution({ ...openSource, licenseSpdxId: "NOASSERTION" }, USER)).toEqual({
      counted: true,
      excludedReason: null,
    });
  });

  it("excludes the user's own repositories, whatever their license", () => {
    const own = { ...openSource, ownerGithubId: USER };
    expect(classifyContribution(own, USER)).toEqual({ counted: false, excludedReason: "own_repo" });
    expect(classifyContribution({ ...own, licenseSpdxId: null }, USER).excludedReason).toBe(
      "own_repo",
    );
  });

  it("reports private repositories and forks as such, even the user's own", () => {
    const own = { ...openSource, ownerGithubId: USER };
    expect(classifyContribution({ ...own, isPrivate: true }, USER).excludedReason).toBe("private");
    expect(classifyContribution({ ...own, isFork: true }, USER).excludedReason).toBe("fork");
  });
});
