import contract from "../../contract/openapi.json";
import { normalizeDigits } from "./digits";
import type { components } from "./api/schema";
import {
  initialFormState,
  type FieldError,
  type FormState,
} from "./form-state";

export { initialFormState };
export type { FieldError, FormState };

type Schemas = components["schemas"];
type Link = Schemas["Link"];
type UpdateMeRequest = Schemas["UpdateMeRequest"];
type CreateProjectRequest = Schemas["CreateProjectRequest"];
type UpdateProjectRequest = Schemas["UpdateProjectRequest"];

function fromContract(...path: string[]): unknown {
  let node: unknown = contract.components.schemas;
  for (const step of path) {
    node =
      typeof node === "object" && node !== null
        ? (node as Record<string, unknown>)[step]
        : undefined;
  }
  if (node === undefined) {
    throw new Error(`contract is missing components.schemas.${path.join(".")}`);
  }

  return node;
}

function limit(...path: string[]): number {
  const value = fromContract(...path);
  if (typeof value !== "number") {
    throw new Error(`contract: components.schemas.${path.join(".")} is not a number`);
  }

  return value;
}

function pattern(...path: string[]): RegExp {
  const value = fromContract(...path);
  if (typeof value !== "string") {
    throw new Error(`contract: components.schemas.${path.join(".")} is not a string`);
  }

  return new RegExp(value);
}

// The limits live in the contract, the one place the platform publishes them.
export const LIMITS = {
  handlePattern: pattern("UpdateMeRequest", "properties", "handle", "pattern"),
  displayNameMax: limit("UpdateMeRequest", "properties", "displayName", "maxLength"),
  bioMax: limit("UpdateMeRequest", "properties", "bio", "maxLength"),
  linksMax: limit("UpdateMeRequest", "properties", "links", "maxItems"),
  linkLabelMax: limit("Link", "properties", "label", "maxLength"),
  urlMax: limit("Link", "properties", "url", "maxLength"),
  slugPattern: pattern("CreateProjectRequest", "properties", "slug", "pattern"),
  slugMin: limit("CreateProjectRequest", "properties", "slug", "minLength"),
  slugMax: limit("CreateProjectRequest", "properties", "slug", "maxLength"),
  projectNameMax: limit("CreateProjectRequest", "properties", "name", "maxLength"),
  oneLinerMax: limit("CreateProjectRequest", "properties", "oneLiner", "maxLength"),
  inviteCodeMax: limit("SignInRequest", "properties", "inviteCode", "maxLength"),
} as const;

export type ValidationResult<T> =
  | { ok: true; body: T }
  | { ok: false; state: FormState };

type Errors = Record<string, FieldError>;

const STAGES = ["idea", "building", "launched"] as const;
const VISIBILITIES = ["members", "public"] as const;

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function submittedValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of form.entries()) {
    if (typeof value === "string") values[name] = value;
  }

  return values;
}

function failure(form: FormData, errors: Errors): { ok: false; state: FormState } {
  return { ok: false, state: { errors, values: submittedValues(form) } };
}

// Lengths are UTF-16 units, never fewer than code points, so the storefront
// never lets through a value the platform would count as too long.
function checkLength(
  errors: Errors,
  field: string,
  value: string,
  max: number,
  required: boolean,
) {
  if (required && value === "") errors[field] = { key: "required" };
  else if (value.length > max) errors[field] = { key: "tooLong", max };
}

function normalizedHandle(value: string): string {
  return normalizeDigits(value.trim()).toLowerCase();
}

function handleError(handle: string): FieldError | undefined {
  if (handle === "") return { key: "required" };
  if (!LIMITS.handlePattern.test(handle)) return { key: "handlePattern" };

  return undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function readLinks(form: FormData): { links: Link[]; errors: Errors } {
  const links: Link[] = [];
  const errors: Errors = {};

  for (let i = 0; i < LIMITS.linksMax; i++) {
    const label = text(form, `links.${i}.label`);
    const url = text(form, `links.${i}.url`);
    if (label === "" && url === "") continue;
    if (label === "" || url === "") {
      errors[`links.${i}`] = { key: "linkIncomplete" };
      continue;
    }

    let valid = true;
    if (label.length > LIMITS.linkLabelMax) {
      errors[`links.${i}.label`] = { key: "tooLong", max: LIMITS.linkLabelMax };
      valid = false;
    }
    if (url.length > LIMITS.urlMax || !isHttpUrl(url)) {
      errors[`links.${i}.url`] = { key: "urlInvalid" };
      valid = false;
    }
    if (valid) links.push({ label, url });
  }

  return { links, errors };
}

export function validateProfile(form: FormData): ValidationResult<UpdateMeRequest> {
  const errors: Errors = {};

  const handle = normalizedHandle(text(form, "handle"));
  const handleProblem = handleError(handle);
  if (handleProblem) errors.handle = handleProblem;

  const displayName = text(form, "displayName");
  checkLength(errors, "displayName", displayName, LIMITS.displayNameMax, true);

  const bio = text(form, "bio");
  checkLength(errors, "bio", bio, LIMITS.bioMax, false);

  const read = readLinks(form);
  Object.assign(errors, read.errors);

  if (Object.keys(errors).length > 0) return failure(form, errors);

  return { ok: true, body: { handle, displayName, bio, links: read.links } };
}

function oneOf<T extends string>(
  allowed: readonly T[],
  value: string,
  fallback: T,
): T {
  return allowed.find((item) => item === value) ?? fallback;
}

export function validateProject(
  form: FormData,
  mode: "create",
): ValidationResult<CreateProjectRequest>;
export function validateProject(
  form: FormData,
  mode: "update",
): ValidationResult<UpdateProjectRequest>;
export function validateProject(
  form: FormData,
  mode: "create" | "update",
): ValidationResult<CreateProjectRequest> | ValidationResult<UpdateProjectRequest> {
  const errors: Errors = {};

  const name = text(form, "name");
  checkLength(errors, "name", name, LIMITS.projectNameMax, true);

  const slug = normalizeDigits(text(form, "slug")).toLowerCase();
  if (mode === "create") {
    if (slug === "") errors.slug = { key: "required" };
    else if (slug.length < LIMITS.slugMin) {
      errors.slug = { key: "tooShort", min: LIMITS.slugMin };
    } else if (slug.length > LIMITS.slugMax) {
      errors.slug = { key: "tooLong", max: LIMITS.slugMax };
    } else if (!LIMITS.slugPattern.test(slug)) {
      errors.slug = { key: "slugPattern" };
    }
  }

  const oneLiner = text(form, "oneLiner");
  checkLength(errors, "oneLiner", oneLiner, LIMITS.oneLinerMax, false);

  const stage = oneOf(STAGES, text(form, "stage"), "idea");
  const visibility = oneOf(VISIBILITIES, text(form, "visibility"), "members");

  const read = readLinks(form);
  Object.assign(errors, read.errors);

  if (Object.keys(errors).length > 0) return failure(form, errors);

  const body = { name, oneLiner, stage, visibility, links: read.links };

  return mode === "create"
    ? { ok: true, body: { ...body, slug } }
    : { ok: true, body };
}

export function validateHandle(
  value: unknown,
): { ok: true; handle: string } | { ok: false; error: FieldError } {
  const handle = typeof value === "string" ? normalizedHandle(value) : "";
  const error = handleError(handle);

  return error ? { ok: false, error } : { ok: true, handle };
}

// undefined: no invite code; null: present but invalid.
export function readInviteCode(value: unknown): string | undefined | null {
  if (typeof value !== "string") return undefined;
  const code = normalizeDigits(value.trim());
  if (code === "") return undefined;

  return code.length > LIMITS.inviteCodeMax ? null : code;
}
