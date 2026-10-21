import contract from "../../contract/openapi.json";
import type { Locale } from "@/i18n/routing";
import { normalizeDigits } from "./digits";
import type { components } from "./api/schema";
import {
  initialFormState,
  type FieldError,
  type FormState,
} from "./form-state";
import { isoFromParts, recheckChoices } from "./recheck";

export { initialFormState };
export type { FieldError, FormState };

type Schemas = components["schemas"];
type Link = Schemas["Link"];
type UpdateMeRequest = Schemas["UpdateMeRequest"];
type CreateProjectRequest = Schemas["CreateProjectRequest"];
type UpdateProjectRequest = Schemas["UpdateProjectRequest"];
type CreatePostRequest = Schemas["CreatePostRequest"];
type CreateCaseRequest = Schemas["CreateCaseRequest"];
type UpdateCaseRequest = Schemas["UpdateCaseRequest"];
type ItemVisibility = Schemas["ItemVisibility"];
type SetVisibilityRequest = Schemas["SetVisibilityRequest"];
type GiveFeedbackRequest = Schemas["GiveFeedbackRequest"];
type EditFeedbackRequest = Schemas["EditFeedbackRequest"];
type RespondRequest = Schemas["RespondRequest"];
type ReplyRequest = Schemas["ReplyRequest"];

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
  postBodyMax: limit("CreateWipPostRequest", "properties", "body", "maxLength"),
  questionsMax: limit("CreateWipPostRequest", "properties", "feedbackWanted", "maxItems"),
  questionMax: limit(
    "CreateWipPostRequest",
    "properties",
    "feedbackWanted",
    "items",
    "maxLength",
  ),
  selfCritiqueMax: limit("CreateWipPostRequest", "properties", "selfCritique", "maxLength"),
  whatChangedMax: limit("CreateUpdatePostRequest", "properties", "whatChanged", "maxLength"),
  actedOnMax: limit("CreateUpdatePostRequest", "properties", "actedOn", "maxItems"),
  rejectedAndWhyMax: limit(
    "CreateUpdatePostRequest",
    "properties",
    "rejectedAndWhy",
    "maxLength",
  ),
  oneNumberMax: limit("CreateUpdatePostRequest", "properties", "oneNumber", "maxLength"),
  feedbackBodyMax: limit("GiveFeedbackRequest", "properties", "body", "maxLength"),
  reasonMax: limit("RespondRequest", "properties", "reason", "maxLength"),
  replyBodyMax: limit("ReplyRequest", "properties", "body", "maxLength"),
  caseTitleMax: limit("CreateCaseRequest", "properties", "title", "maxLength"),
  caseFeedbackStoryMax: limit("CreateCaseRequest", "properties", "feedbackStory", "maxLength"),
  caseChangeMax: limit("CreateCaseRequest", "properties", "change", "maxLength"),
  caseResultMax: limit("CreateCaseRequest", "properties", "result", "maxLength"),
  caseOneNumberMax: limit("CreateCaseRequest", "properties", "oneNumber", "maxLength"),
  caseFeedbackMin: limit("CreateCaseRequest", "properties", "feedbackIds", "minItems"),
  caseFeedbackMax: limit("CreateCaseRequest", "properties", "feedbackIds", "maxItems"),
  casePostsMax: limit("CreateCaseRequest", "properties", "postIds", "maxItems"),
} as const;

export type ValidationResult<T> =
  | { ok: true; body: T }
  | { ok: false; state: FormState };

type Errors = Record<string, FieldError>;

const STAGES = ["idea", "building", "launched"] as const;
const VISIBILITIES = ["members", "public"] as const;
const ITEM_VISIBILITIES = ["inherit", "members", "public"] as const satisfies readonly ItemVisibility[];

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// A name that repeats (a group of checkboxes) keeps every value, joined by ",".
function submittedValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of form.entries()) {
    if (typeof value !== "string") continue;
    values[name] = Object.hasOwn(values, name)
      ? `${values[name]},${value}`
      : value;
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "" (absent or empty) is no choice; anything but the three settings is an error.
function readVisibility(form: FormData): { visibility?: ItemVisibility; error?: FieldError } {
  const visibility = text(form, "visibility");
  if (visibility === "") return {};
  const chosen = ITEM_VISIBILITIES.find((option) => option === visibility);

  return chosen ? { visibility: chosen } : { error: { key: "chooseOne" } };
}

export function validateVisibility(form: FormData): ValidationResult<SetVisibilityRequest> {
  const { visibility } = readVisibility(form);
  if (visibility === undefined) {
    return failure(form, { visibility: { key: "chooseOne" } });
  }

  return { ok: true, body: { visibility } };
}

// The same body serves creating a post and editing it.
export function validatePost(
  form: FormData,
  kind: "wip" | "update",
): ValidationResult<CreatePostRequest> {
  const errors: Errors = {};
  const body = text(form, "body");
  const { visibility, error: visibilityError } = readVisibility(form);
  if (visibilityError) errors.visibility = visibilityError;

  if (kind === "wip") {
    checkLength(errors, "body", body, LIMITS.postBodyMax, true);

    const feedbackWanted: string[] = [];
    for (let i = 0; i < LIMITS.questionsMax; i++) {
      const question = text(form, `question${i}`);
      if (question === "") continue;
      if (question.length > LIMITS.questionMax) {
        errors[`question${i}`] = { key: "tooLong", max: LIMITS.questionMax };
      }
      feedbackWanted.push(question);
    }
    if (feedbackWanted.length === 0) errors.question0 = { key: "required" };

    const selfCritique = text(form, "selfCritique");
    checkLength(errors, "selfCritique", selfCritique, LIMITS.selfCritiqueMax, false);

    if (Object.keys(errors).length > 0) return failure(form, errors);

    return {
      ok: true,
      body: {
        kind,
        body,
        feedbackWanted,
        ...(selfCritique === "" ? {} : { selfCritique }),
        ...(visibility === undefined ? {} : { visibility }),
      },
    };
  }

  checkLength(errors, "body", body, LIMITS.postBodyMax, false);
  const whatChanged = text(form, "whatChanged");
  checkLength(errors, "whatChanged", whatChanged, LIMITS.whatChangedMax, true);
  const oneNumber = text(form, "oneNumber");
  checkLength(errors, "oneNumber", oneNumber, LIMITS.oneNumberMax, true);
  const rejectedAndWhy = text(form, "rejectedAndWhy");
  checkLength(errors, "rejectedAndWhy", rejectedAndWhy, LIMITS.rejectedAndWhyMax, false);

  const actedOn = [
    ...new Set(
      form
        .getAll("actedOn")
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => UUID.test(value)),
    ),
  ].slice(0, LIMITS.actedOnMax);

  if (Object.keys(errors).length > 0) return failure(form, errors);

  return {
    ok: true,
    body: {
      kind,
      body,
      whatChanged,
      actedOn,
      oneNumber,
      ...(rejectedAndWhy === "" ? {} : { rejectedAndWhy }),
      ...(visibility === undefined ? {} : { visibility }),
    },
  };
}

// A repeated checkbox name: the ids that look like ids, once each, the first `max`.
function readIds(form: FormData, name: string, max: number): string[] {
  return [
    ...new Set(
      form
        .getAll(name)
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => UUID.test(value)),
    ),
  ].slice(0, max);
}

export function validateCase(
  form: FormData,
  mode: "create",
): ValidationResult<CreateCaseRequest>;
export function validateCase(
  form: FormData,
  mode: "update",
): ValidationResult<UpdateCaseRequest>;
export function validateCase(
  form: FormData,
  mode: "create" | "update",
): ValidationResult<CreateCaseRequest> | ValidationResult<UpdateCaseRequest> {
  const errors: Errors = {};

  const title = text(form, "title");
  checkLength(errors, "title", title, LIMITS.caseTitleMax, true);
  const feedbackStory = text(form, "feedbackStory");
  checkLength(errors, "feedbackStory", feedbackStory, LIMITS.caseFeedbackStoryMax, true);
  const change = text(form, "change");
  checkLength(errors, "change", change, LIMITS.caseChangeMax, true);
  const result = text(form, "result");
  checkLength(errors, "result", result, LIMITS.caseResultMax, true);
  const oneNumber = text(form, "oneNumber");
  checkLength(errors, "oneNumber", oneNumber, LIMITS.caseOneNumberMax, false);

  const { visibility, error: visibilityError } = readVisibility(form);
  if (visibilityError) errors.visibility = visibilityError;

  const feedbackIds = readIds(form, "feedbackIds", LIMITS.caseFeedbackMax);
  if (feedbackIds.length < LIMITS.caseFeedbackMin) {
    errors.feedbackIds = { key: "chooseOne" };
  }
  const postIds = readIds(form, "postIds", LIMITS.casePostsMax);

  if (Object.keys(errors).length > 0) return failure(form, errors);

  const body = {
    title,
    feedbackStory,
    change,
    result,
    feedbackIds,
    postIds,
    ...(visibility === undefined ? {} : { visibility }),
  };

  // An edit always sends the number ("" clears it); a new case leaves it out.
  return {
    ok: true,
    body: mode === "update" ? { ...body, oneNumber } : { ...body, ...(oneNumber === "" ? {} : { oneNumber }) },
  };
}

export function validateFeedback(
  form: FormData,
  mode: "give",
): ValidationResult<GiveFeedbackRequest>;
export function validateFeedback(
  form: FormData,
  mode: "edit",
): ValidationResult<EditFeedbackRequest>;
export function validateFeedback(
  form: FormData,
  mode: "give" | "edit",
): ValidationResult<GiveFeedbackRequest> | ValidationResult<EditFeedbackRequest> {
  const errors: Errors = {};

  const body = text(form, "body");
  checkLength(errors, "body", body, LIMITS.feedbackBodyMax, true);

  // "" means a general piece of feedback; the question numbers are 0-4.
  const picked = text(form, "questionIndex");
  let questionIndex: number | null = null;
  if (picked !== "") {
    if (/^[0-4]$/.test(picked)) questionIndex = Number(picked);
    else errors.questionIndex = { key: "chooseOne" };
  }

  if (Object.keys(errors).length > 0) return failure(form, errors);

  return mode === "give"
    ? {
        ok: true,
        body: { body, ...(questionIndex === null ? {} : { questionIndex }) },
      }
    : { ok: true, body: { body, questionIndex } };
}

const RESPONSE_STATUSES = ["accepted", "rejected", "testing"] as const;

// A day that exists: 2026-11-45 is not a date, and neither is 2027-02-30.
function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const date = new Date(`${iso}T12:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso;
}

// The date a "testing" answer reports back on: a quick pick carries its own
// date, "other" is read from three selects in the member's calendar.
function recheckDate(
  form: FormData,
  now: Date,
  locale: Locale,
): { ok: true; iso: string } | { ok: false; error: FieldError } {
  const pick = text(form, "recheckPick");
  const { min, max } = recheckChoices(now, locale);

  if (pick === "") return { ok: false, error: { key: "chooseOne" } };
  if (pick === "other") {
    const iso = isoFromParts(
      {
        year: Number(normalizeDigits(text(form, "recheckYear"))),
        month: Number(normalizeDigits(text(form, "recheckMonth"))),
        day: Number(normalizeDigits(text(form, "recheckDay"))),
      },
      now,
      locale,
    );

    return iso === null
      ? { ok: false, error: { key: "dateInvalid" } }
      : { ok: true, iso };
  }
  if (isRealDate(pick) && pick >= min && pick <= max) {
    return { ok: true, iso: pick };
  }

  return { ok: false, error: { key: "dateInvalid" } };
}

export function validateResponse(
  form: FormData,
  now: Date,
  locale: Locale,
): ValidationResult<RespondRequest> {
  const errors: Errors = {};

  const picked = text(form, "status");
  const status = RESPONSE_STATUSES.find((item) => item === picked);
  if (status === undefined) errors.status = { key: "chooseOne" };

  const reason = text(form, "reason");
  if (reason === "") errors.reason = { key: "reasonRequired" };
  else if (reason.length > LIMITS.reasonMax) {
    errors.reason = { key: "tooLong", max: LIMITS.reasonMax };
  }

  let recheckOn: string | undefined;
  if (status === "testing") {
    const date = recheckDate(form, now, locale);
    if (date.ok) recheckOn = date.iso;
    else errors.recheckOn = date.error;
  }

  if (status === undefined || Object.keys(errors).length > 0) {
    return failure(form, errors);
  }

  return {
    ok: true,
    body: { status, reason, ...(recheckOn === undefined ? {} : { recheckOn }) },
  };
}

export function validateReply(form: FormData): ValidationResult<ReplyRequest> {
  const errors: Errors = {};

  const body = text(form, "body");
  checkLength(errors, "body", body, LIMITS.replyBodyMax, true);

  if (Object.keys(errors).length > 0) return failure(form, errors);

  return { ok: true, body: { body } };
}
