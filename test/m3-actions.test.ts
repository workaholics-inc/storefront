import { revalidatePath } from "next/cache";
import { NextIntlClientProvider } from "next-intl";
import {
  createElement,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import { setPostVisibility } from "@/app/[locale]/projects/[slug]/posts/[id]/actions";
import { createPost } from "@/app/[locale]/projects/[slug]/posts/actions";
import { PostForm } from "@/components/post/post-form";
import { VisibilityForm } from "@/components/post/visibility-form";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import type { FormState } from "@/lib/form-state";
import { initialFormState } from "@/lib/form-state";
import { validateVisibility } from "@/lib/validation";
import contract from "../contract/openapi.json";

type PostData = components["schemas"]["Post"];
type Answer = { data?: unknown; error?: unknown; response: Response } | Error;

const h = vi.hoisted(() => ({
  calls: [] as { method: string; path: string; init: unknown }[],
  answer: undefined as unknown,
  deleted: [] as string[],
}));

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getPlatformClient: async () => {
    const call = (method: string) => async (path: string, init: unknown) => {
      h.calls.push({ method, path, init });
      if (h.answer instanceof Error) throw h.answer;
      return h.answer;
    };
    return {
      GET: call("GET"),
      PATCH: call("PATCH"),
      POST: call("POST"),
      PUT: call("PUT"),
      DELETE: call("DELETE"),
    };
  },
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (path: string) => {
    throw Object.assign(new Error("redirect"), { path });
  },
}));

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  cookies: async () => ({
    delete: (name: string) => {
      h.deleted.push(name);
    },
    get: () => undefined,
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const messages = { fa, en };
const locales = ["fa", "en"] as const;

const POST_ID = "0199f1a2-7c3e-7a10-8000-000000000101";
const THREAD = `/projects/daftar/posts/${POST_ID}`;

function ok(data: unknown, status = 200): Answer {
  return { data, response: new Response(null, { status }) };
}

function fail(status: number, code: string): Answer {
  return {
    error: { error: { code, message: "ignored" } },
    response: new Response(null, { status }),
  };
}

function formOf(fields: Record<string, string>) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

type Outcome = { state: FormState } | { redirect: string };

async function outcome(run: Promise<FormState>): Promise<Outcome> {
  try {
    return { state: await run };
  } catch (error) {
    if (error instanceof Error && "path" in error) {
      return { redirect: String(error.path) };
    }
    throw error;
  }
}

function bodyOf(index = 0): unknown {
  return (h.calls[index]?.init as { body: unknown }).body;
}

beforeEach(() => {
  h.calls = [];
  h.answer = undefined;
  h.deleted = [];
  vi.mocked(revalidatePath).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const wip = {
  kind: "wip",
  body: "A first pass at the importer.",
  question0: "Is the retry loop too eager?",
  question1: "",
  question2: "Does the naming read well?",
  selfCritique: "",
};

const update = {
  kind: "update",
  body: "",
  whatChanged: "Retries now back off.",
  oneNumber: "3 of 5",
  rejectedAndWhy: "",
};

const CHOOSE_ONE = { visibility: { key: "chooseOne" } };

describe("validateVisibility", () => {
  it.each(["inherit", "members", "public"])("accepts %s", (value) => {
    expect(validateVisibility(formOf({ visibility: value }))).toStrictEqual({
      ok: true,
      body: { visibility: value },
    });
  });

  it("trims what it reads", () => {
    expect(validateVisibility(formOf({ visibility: " public " }))).toStrictEqual({
      ok: true,
      body: { visibility: "public" },
    });
  });

  it.each([
    ["no field", {}, {}],
    ["an empty value", { visibility: "" }, { visibility: "" }],
    ["a value that is not a choice", { visibility: "everyone" }, { visibility: "everyone" }],
    ["a choice with one letter off", { visibility: "Public" }, { visibility: "Public" }],
    [
      "a bad value among other fields",
      { visibility: "everyone", note: "kept" },
      { visibility: "everyone", note: "kept" },
    ],
  ])("refuses %s and keeps what was submitted", (_name, fields, values) => {
    expect(validateVisibility(formOf(fields))).toStrictEqual({
      ok: false,
      state: { errors: CHOOSE_ONE, values },
    });
  });
});

describe("createPost with a visibility", () => {
  const wipBody = {
    kind: "wip",
    body: wip.body,
    feedbackWanted: [wip.question0, wip.question2],
  };
  const updateBody = {
    kind: "update",
    body: "",
    whatChanged: update.whatChanged,
    actedOn: [],
    oneNumber: update.oneNumber,
  };

  it.each(["inherit", "members", "public"])(
    "sends a work in progress with visibility %s and redirects to the post",
    async (visibility) => {
      h.answer = ok({ id: POST_ID }, 201);

      const result = await outcome(
        createPost("fa", "daftar", initialFormState, formOf({ ...wip, visibility })),
      );

      expect(result).toStrictEqual({ redirect: THREAD });
      expect(h.calls).toStrictEqual([
        {
          method: "POST",
          path: "/v1/projects/{slug}/posts",
          init: {
            params: { path: { slug: "daftar" } },
            body: { ...wipBody, visibility },
          },
        },
      ]);
    },
  );

  it("sends an update with visibility public", async () => {
    h.answer = ok({ id: POST_ID }, 201);

    await outcome(
      createPost("fa", "daftar", initialFormState, formOf({ ...update, visibility: "public" })),
    );

    expect(h.calls).toHaveLength(1);
    expect(bodyOf()).toStrictEqual({ ...updateBody, visibility: "public" });
  });

  it.each([
    ["a work in progress with no visibility field", wip, wipBody],
    ["an update with no visibility field", update, updateBody],
    ["a work in progress with an empty visibility", { ...wip, visibility: "" }, wipBody],
  ])("leaves the key out for %s", async (_name, fields, expected) => {
    h.answer = ok({ id: POST_ID }, 201);

    await outcome(createPost("fa", "daftar", initialFormState, formOf(fields)));

    expect(h.calls).toHaveLength(1);
    expect(bodyOf()).toStrictEqual(expected);
    expect("visibility" in (bodyOf() as object)).toBe(false);
  });

  it.each([
    ["a work in progress", wip],
    ["an update", update],
  ])("sends nothing for %s with a visibility that is not a choice", async (_name, fields) => {
    h.answer = ok({ id: POST_ID }, 201);

    const result = await outcome(
      createPost(
        "fa",
        "daftar",
        initialFormState,
        formOf({ ...fields, visibility: "everyone" }),
      ),
    );

    expect(result).toStrictEqual({
      state: {
        errors: CHOOSE_ONE,
        values: { ...fields, visibility: "everyone" },
      },
    });
    expect(h.calls).toStrictEqual([]);
  });

  it("reports the visibility together with the other fields, not instead of them", async () => {
    const fields = { ...wip, visibility: "everyone", question0: "", question2: "" };

    const result = await outcome(
      createPost("fa", "daftar", initialFormState, formOf(fields)),
    );

    expect(result).toStrictEqual({
      state: {
        errors: { ...CHOOSE_ONE, question0: { key: "required" } },
        values: fields,
      },
    });
    expect(h.calls).toStrictEqual([]);
  });
});

describe("setPostVisibility", () => {
  const SAVED = ok({ id: POST_ID, visibility: "inherit", isPublic: false });
  const call = (
    fields: Record<string, string>,
    locale = "fa",
    slug = "daftar",
    id = POST_ID,
  ) =>
    outcome(setPostVisibility(locale, slug, id, initialFormState, formOf(fields)));
  const put = (visibility: string) => ({
    method: "PUT",
    path: "/v1/posts/{id}/visibility",
    init: { params: { path: { id: POST_ID } }, body: { visibility } },
  });

  it.each([
    ["fa", "inherit"],
    ["fa", "members"],
    ["fa", "public"],
    ["en", "public"],
  ])("saves %s visibility %s and returns the submitted value", async (locale, visibility) => {
    h.answer = SAVED;

    const result = await call({ visibility }, locale);

    expect(result).toStrictEqual({ state: { errors: {}, values: { visibility } } });
    expect(h.calls).toStrictEqual([put(visibility)]);
    expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual([
      ["/[locale]/projects/[slug]/posts/[id]", "page"],
      ["/[locale]/projects/[slug]", "page"],
    ]);
  });

  it("sends only the visibility, whatever else is submitted", async () => {
    h.answer = SAVED;

    await call({ visibility: "public", kind: "update" });

    expect(h.calls).toStrictEqual([put("public")]);
  });

  it("sends and returns the checked value, not the raw one", async () => {
    h.answer = SAVED;

    const result = await call({ visibility: " members " });

    expect(result).toStrictEqual({ state: { errors: {}, values: { visibility: "members" } } });
    expect(h.calls).toStrictEqual([put("members")]);
  });

  it.each([
    ["no field", {}],
    ["an empty value", { visibility: "" }],
    ["a value that is not a choice", { visibility: "everyone" }],
    ["a choice with one letter off", { visibility: "Public" }],
  ])("refuses %s without a call or a refresh", async (_name, fields) => {
    h.answer = SAVED;

    const result = await call(fields);

    expect(result).toStrictEqual({ state: { errors: CHOOSE_ONE, values: fields } });
    expect(h.calls).toStrictEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["a slug with a path in it", "../x", POST_ID],
    ["a slug in capitals", "Daftar", POST_ID],
    ["a slug that is a host", "//evil.example", POST_ID],
    ["an empty slug", "", POST_ID],
    ["an id that is not a UUID", "daftar", "nope"],
    ["an id with a path in it", "daftar", `${POST_ID}/../x`],
  ])("answers not_found without a call for %s", async (_name, slug, id) => {
    h.answer = SAVED;

    const result = await call({ visibility: "public" }, "fa", slug, id);

    expect(result).toStrictEqual({
      state: { errors: {}, formError: "not_found", values: { visibility: "public" } },
    });
    expect(h.calls).toStrictEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("checks the bound arguments before the visibility", async () => {
    const result = await call({ visibility: "everyone" }, "fa", "../x");

    expect(result).toStrictEqual({
      state: { errors: {}, formError: "not_found", values: { visibility: "everyone" } },
    });
    expect(h.calls).toStrictEqual([]);
  });

  it.each([
    [400, "validation_failed", "validation_failed"],
    [401, "storefront_key_invalid", "internal_error"],
    [403, "not_project_owner", "not_project_owner"],
    [403, "forbidden", "not_project_owner"],
    [404, "not_found", "not_found"],
    [409, "edit_window_closed", "edit_window_closed"],
    [429, "rate_limited", "rate_limited"],
    [409, "no_such_code", "internal_error"],
  ])("maps a %s %s to %s and keeps the form", async (status, code, formError) => {
    h.answer = fail(status, code);

    const result = await call({ visibility: "public" });

    expect(result).toStrictEqual({
      state: { errors: {}, formError, values: { visibility: "public" } },
    });
    expect(h.calls).toStrictEqual([put("public")]);
    expect(h.deleted).toStrictEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("maps a call that throws to unreachable", async () => {
    h.answer = new Error("connect ECONNREFUSED");

    const result = await call({ visibility: "public" });

    expect(result).toStrictEqual({
      state: { errors: {}, formError: "unreachable", values: { visibility: "public" } },
    });
    expect(h.deleted).toStrictEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    [
      "fa",
      `/sign-in?error=session_required&next=%2Fprojects%2Fdaftar%2Fposts%2F${POST_ID}`,
    ],
    [
      "en",
      `/en/sign-in?error=session_required&next=%2Fen%2Fprojects%2Fdaftar%2Fposts%2F${POST_ID}`,
    ],
    [
      "//evil.example",
      `/sign-in?error=session_required&next=%2Fprojects%2Fdaftar%2Fposts%2F${POST_ID}`,
    ],
  ])("deletes the session cookie and redirects to sign-in on session_required in %s", async (locale, path) => {
    h.answer = fail(401, "session_required");

    const result = await call({ visibility: "public" }, locale);

    expect(result).toStrictEqual({ redirect: path });
    expect(h.deleted).toStrictEqual(["wh_session"]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// useActionState renders on the server, so these are first renders.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

function inLocale(locale: Locale, child: ReactNode) {
  return renderToStaticMarkup(
    createElement(Provider, { locale, messages: messages[locale] }, child),
  );
}

const noop = async (state: never) => state;
const action = noop as unknown as ComponentProps<typeof PostForm>["action"];

type Attrs = Record<string, string>;

function attrsOf(source: string): Attrs {
  const attrs: Attrs = {};

  for (const match of source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) {
    attrs[match[1] ?? ""] = match[2] ?? "";
  }

  return attrs;
}

function decode(text: string) {
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function visibleText(html: string) {
  return decode(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function openTags(html: string, name: string): Attrs[] {
  return [...html.matchAll(new RegExp(`<${name}(\\s[^>]*)?>`, "g"))].map((match) =>
    attrsOf(match[1] ?? ""),
  );
}

const inputs = (html: string, name: string) =>
  openTags(html, "input").filter((input) => input.name === name);

function selects(html: string) {
  return [...html.matchAll(/<select(\s[^>]*)?>([\s\S]*?)<\/select>/g)].map((match) => ({
    attrs: attrsOf(match[1] ?? ""),
    options: [...(match[2] ?? "").matchAll(/<option(\s[^>]*)?>([^<]*)<\/option>/g)].map(
      (option) => {
        const attrs = attrsOf(option[1] ?? "");

        return {
          value: attrs.value ?? "",
          label: decode(option[2] ?? ""),
          selected: "selected" in attrs,
        };
      },
    ),
  }));
}

const visibilitySelects = (html: string) =>
  selects(html).filter((select) => select.attrs.name === "visibility");

function optionsOf(locale: Locale, selected: string) {
  const t = messages[locale].Visibility;

  return [
    { value: "inherit", label: t.inherit, selected: selected === "inherit" },
    { value: "members", label: t.members, selected: selected === "members" },
    { value: "public", label: t.public, selected: selected === "public" },
  ];
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("the example is missing a value this test reads");
  }

  return value;
}

describe("PostForm and its visibility choice", () => {
  const limits = {
    postBodyMax: 5001,
    questionsMax: 5,
    questionMax: 281,
    selfCritiqueMax: 1001,
    whatChangedMax: 3001,
    actedOnMax: 21,
    rejectedAndWhyMax: 2001,
    oneNumberMax: 201,
  };
  const posts = contract.components.schemas.PostPage.example.items as PostData[];
  const updatePost = required(posts[0]);
  const wipPost = required(posts[1]);

  function render(locale: Locale, props: Partial<ComponentProps<typeof PostForm>> = {}) {
    return inLocale(
      locale,
      createElement(PostForm, {
        action,
        mode: "create",
        limits,
        actedOnOptions: [],
        ...props,
      }),
    );
  }

  it.each(locales)("offers the three choices with the project's own chosen when creating (%s)", (locale) => {
    const html = render(locale);

    expect(visibilitySelects(html).map((select) => select.options)).toStrictEqual([
      optionsOf(locale, "inherit"),
    ]);
    expect(visibleText(html)).not.toContain(messages[locale].Visibility.channelNote);
  });

  it.each(locales)("has no visibility choice when editing an update (%s)", (locale) => {
    const html = render(locale, { mode: "edit", initial: updatePost });

    expect(visibilitySelects(html)).toStrictEqual([]);
    expect(inputs(html, "visibility")).toStrictEqual([]);
    expect(visibleText(html)).not.toContain(messages[locale].Visibility.channelNote);
  });

  it.each(locales)("has no visibility choice when editing a work in progress (%s)", (locale) => {
    const html = render(locale, { mode: "edit", initial: wipPost });

    expect(visibilitySelects(html)).toStrictEqual([]);
    expect(inputs(html, "visibility")).toStrictEqual([]);
    expect(visibleText(html)).not.toContain(messages[locale].Visibility.channelNote);
  });
});

describe("VisibilityForm", () => {
  function render(
    locale: Locale,
    props: Partial<ComponentProps<typeof VisibilityForm>> = {},
  ) {
    return inLocale(
      locale,
      createElement(VisibilityForm, {
        action,
        visibility: "inherit",
        isPublic: false,
        postKind: "wip",
        ...props,
      }),
    );
  }

  function stateLine(html: string) {
    const match = /<section[^>]*\sid="visibility"[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/.exec(html);

    return { html: match?.[0] ?? "", text: visibleText(match?.[1] ?? "") };
  }

  it.each(locales.flatMap((locale) => (["inherit", "members", "public"] as const).map((value) => [locale, value] as const)))(
    "shows the three choices with %s %s chosen",
    (locale, value) => {
      const html = render(locale, { visibility: value });

      expect(visibilitySelects(html).map((select) => select.options)).toStrictEqual([
        optionsOf(locale, value),
      ]);
    },
  );

  it.each(locales)("says what visitors see right now when the post is public (%s)", (locale) => {
    const t = messages[locale];
    const line = stateLine(render(locale, { visibility: "inherit", isPublic: true }));

    expect(line.text).toBe(`${t.PublicBadge.public} ${t.Visibility.effectivePublic}`);
    expect(render(locale, { visibility: "inherit", isPublic: true })).toContain(
      `title="${t.PublicBadge.publicTitle}"`,
    );
  });

  it.each(locales)("says only members can see it when the post is not public, whatever the choice (%s)", (locale) => {
    const t = messages[locale];
    const html = render(locale, { visibility: "public", isPublic: false });

    expect(stateLine(html).text).toBe(t.Visibility.effectiveMembers);
    expect(html).not.toContain(`title="${t.PublicBadge.publicTitle}"`);
  });

  it.each(locales)("tells owners the change is not an edit, and about the channel only for an update (%s)", (locale) => {
    const t = messages[locale].Visibility;

    for (const [postKind, channel] of [
      ["wip", false],
      ["update", true],
    ] as const) {
      const text = visibleText(render(locale, { postKind }));

      expect(text).toContain(t.changeAnyTime);
      expect(text.includes(t.channelNote)).toBe(channel);
    }
  });

  it.each(locales)("shows no saved notice on the first render and a Save button (%s)", (locale) => {
    const html = render(locale);

    expect(html).not.toContain('role="status"');
    expect(visibleText(html)).not.toContain(messages[locale].Visibility.saved);
    expect(visibleText(html)).toContain(messages[locale].Forms.save);
    expect(openTags(html, "button").map((button) => button.type)).toStrictEqual(["submit"]);
  });
});
