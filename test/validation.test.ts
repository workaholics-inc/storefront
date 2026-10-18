import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import contract from "../contract/openapi.json";
import {
  LIMITS,
  readInviteCode,
  readLinks,
  validateHandle,
  validateProfile,
  validateProject,
  type FormState,
} from "@/lib/validation";

function formOf(fields: Record<string, string>) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

function failureOf(result: { ok: boolean; state?: FormState }): FormState {
  if (result.ok || !result.state) throw new Error("expected a failed result");
  return result.state;
}

function bodyOf<T>(result: { ok: boolean; body?: T }): T {
  if (!result.ok || !result.body) throw new Error("expected a valid result");
  return result.body;
}

const schemas = contract.components.schemas;
const validProfile = { handle: "sara_dev", displayName: "Sara" };

describe("LIMITS", () => {
  it("equals the values in the vendored contract", () => {
    expect(LIMITS.displayNameMax).toBe(schemas.UpdateMeRequest.properties.displayName.maxLength);
    expect(LIMITS.slugMax).toBe(schemas.CreateProjectRequest.properties.slug.maxLength);
    expect(LIMITS.linksMax).toBe(schemas.UpdateMeRequest.properties.links.maxItems);
    expect(LIMITS.handlePattern.source).toBe(schemas.UpdateMeRequest.properties.handle.pattern);
    expect(LIMITS.inviteCodeMax).toBe(schemas.SignInRequest.properties.inviteCode.maxLength);
  });
});

describe("validateProfile", () => {
  it("trims and lower-cases the handle", () => {
    const body = bodyOf(
      validateProfile(formOf({ ...validProfile, handle: " Sara_Dev " })),
    );

    expect(body.handle).toBe("sara_dev");
    expect(body).toEqual({
      handle: "sara_dev",
      displayName: "Sara",
      bio: "",
      links: [],
    });
  });

  it("normalises digits before checking the handle pattern", () => {
    const state = failureOf(
      validateProfile(formOf({ ...validProfile, handle: "۱sara" })),
    );

    expect(state.errors.handle).toEqual({ key: "handlePattern" });
  });

  it("accepts a handle whose digits are Persian, as the Latin digits they stand for", () => {
    const body = bodyOf(
      validateProfile(formOf({ ...validProfile, handle: "sara۱۲" })),
    );

    expect(body.handle).toBe("sara12");
  });

  it("requires a display name", () => {
    const state = failureOf(
      validateProfile(formOf({ ...validProfile, displayName: "  " })),
    );

    expect(state.errors.displayName).toEqual({ key: "required" });
  });

  it("accepts a bio at the limit and rejects one character over", () => {
    expect(
      validateProfile(formOf({ ...validProfile, bio: "b".repeat(LIMITS.bioMax) })).ok,
    ).toBe(true);

    const state = failureOf(
      validateProfile(formOf({ ...validProfile, bio: "b".repeat(LIMITS.bioMax + 1) })),
    );

    expect(state.errors.bio).toEqual({ key: "tooLong", max: LIMITS.bioMax });
  });

  it("keeps the submitted values on failure", () => {
    const state = failureOf(
      validateProfile(
        formOf({ handle: "no", displayName: "Sara", bio: "hello", "links.0.label": "Site" }),
      ),
    );

    expect(state.values).toEqual({
      handle: "no",
      displayName: "Sara",
      bio: "hello",
      "links.0.label": "Site",
    });
  });

  it("carries links into the body", () => {
    const body = bodyOf(
      validateProfile(
        formOf({
          ...validProfile,
          "links.0.label": "Site",
          "links.0.url": "https://sara.example",
        }),
      ),
    );

    expect(body.links).toEqual([{ label: "Site", url: "https://sara.example" }]);
  });
});

describe("readLinks", () => {
  it("returns filled rows in order", () => {
    const { links, errors } = readLinks(
      formOf({
        "links.0.label": " Site ",
        "links.0.url": "https://a.example",
        "links.1.label": "Code",
        "links.1.url": "http://b.example/repo",
      }),
    );

    expect(errors).toEqual({});
    expect(links).toEqual([
      { label: "Site", url: "https://a.example" },
      { label: "Code", url: "http://b.example/repo" },
    ]);
  });

  it("flags a row with only a label, and a row with only an address", () => {
    const { errors } = readLinks(
      formOf({ "links.0.label": "Site", "links.1.url": "https://b.example" }),
    );

    expect(errors["links.0"]).toEqual({ key: "linkIncomplete" });
    expect(errors["links.1"]).toEqual({ key: "linkIncomplete" });
  });

  it("rejects an address that is not http or https", () => {
    const { errors } = readLinks(
      formOf({ "links.0.label": "FTP", "links.0.url": "ftp://x.example" }),
    );

    expect(errors["links.0.url"]).toEqual({ key: "urlInvalid" });
  });

  it("rejects an address that is not absolute, and one over the limit", () => {
    const { errors } = readLinks(
      formOf({
        "links.0.label": "Relative",
        "links.0.url": "example.com",
        "links.1.label": "Long",
        "links.1.url": "https://x.example/" + "a".repeat(LIMITS.urlMax),
      }),
    );

    expect(errors["links.0.url"]).toEqual({ key: "urlInvalid" });
    expect(errors["links.1.url"]).toEqual({ key: "urlInvalid" });
  });

  it("flags a label over the limit", () => {
    const { errors } = readLinks(
      formOf({
        "links.0.label": "l".repeat(LIMITS.linkLabelMax + 1),
        "links.0.url": "https://a.example",
      }),
    );

    expect(errors["links.0.label"]).toEqual({
      key: "tooLong",
      max: LIMITS.linkLabelMax,
    });
  });

  it("skips an empty row", () => {
    const { links, errors } = readLinks(
      formOf({
        "links.0.label": "",
        "links.0.url": "  ",
        "links.1.label": "Site",
        "links.1.url": "https://a.example",
      }),
    );

    expect(errors).toEqual({});
    expect(links).toEqual([{ label: "Site", url: "https://a.example" }]);
  });
});

describe("validateProject", () => {
  const base = { name: "Daftar" };

  it("creates with a normalised slug and the defaults", () => {
    const body = bodyOf(
      validateProject(formOf({ ...base, slug: "Daftar-2" }), "create"),
    );

    expect(body).toEqual({
      name: "Daftar",
      slug: "daftar-2",
      oneLiner: "",
      stage: "idea",
      visibility: "members",
      links: [],
    });
  });

  it("rejects a slug that is too short", () => {
    const state = failureOf(
      validateProject(formOf({ ...base, slug: "a" }), "create"),
    );

    expect(state.errors.slug).toEqual({ key: "tooShort", min: LIMITS.slugMin });
  });

  it("rejects a slug with a doubled hyphen", () => {
    const state = failureOf(
      validateProject(formOf({ ...base, slug: "daf--tar" }), "create"),
    );

    expect(state.errors.slug).toEqual({ key: "slugPattern" });
  });

  it("requires a slug and a name when creating", () => {
    const state = failureOf(validateProject(formOf({}), "create"));

    expect(state.errors.slug).toEqual({ key: "required" });
    expect(state.errors.name).toEqual({ key: "required" });
  });

  it("keeps a valid stage and visibility", () => {
    const body = bodyOf(
      validateProject(
        formOf({ ...base, slug: "daftar", stage: "launched", visibility: "public" }),
        "create",
      ),
    );

    expect(body).toMatchObject({ stage: "launched", visibility: "public" });
  });

  it("ignores the slug when updating", () => {
    const body = bodyOf(
      validateProject(formOf({ ...base, slug: "a" }), "update"),
    );

    expect(body).not.toHaveProperty("slug");
    expect(body).toMatchObject({ name: "Daftar", stage: "idea", visibility: "members" });
  });
});

describe("validateHandle", () => {
  it("passes a reserved-looking name: reserved names are the platform's call", () => {
    expect(validateHandle("admin")).toEqual({ ok: true, handle: "admin" });
  });

  it("fails a handle that is too short", () => {
    expect(validateHandle("ab")).toEqual({
      ok: false,
      error: { key: "handlePattern" },
    });
  });

  it("fails an empty value and a non-string as required", () => {
    expect(validateHandle("  ")).toEqual({ ok: false, error: { key: "required" } });
    expect(validateHandle(42)).toEqual({ ok: false, error: { key: "required" } });
  });
});

describe("readInviteCode", () => {
  it("trims the code", () => {
    expect(readInviteCode("  abc  ")).toBe("abc");
  });

  it("is undefined for an empty or missing value", () => {
    expect(readInviteCode("")).toBeUndefined();
    expect(readInviteCode("   ")).toBeUndefined();
    expect(readInviteCode(null)).toBeUndefined();
  });

  it("is null for a value over the limit, and keeps one at the limit", () => {
    expect(readInviteCode("a".repeat(LIMITS.inviteCodeMax + 1))).toBeNull();
    expect(readInviteCode("a".repeat(LIMITS.inviteCodeMax))).toBe(
      "a".repeat(LIMITS.inviteCodeMax),
    );
  });
});

describe("form-state.ts", () => {
  const source = readFileSync("src/lib/form-state.ts", "utf8");

  it("does not mention the contract file", () => {
    expect(source).not.toContain("openapi.json");
  });

  it("does not import the validation module", () => {
    expect(source).not.toMatch(/from\s+["']\.\/validation["']/);
    expect(source).not.toMatch(/from\s+["']@\/lib\/validation["']/);
  });
});
