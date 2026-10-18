import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import { MemberHead } from "@/components/member/member-head";
import { ProfileForm } from "@/components/member/profile-form";
import { OwnerManager } from "@/components/project/owner-manager";
import { ProjectCard } from "@/components/project/project-card";
import { ProjectForm } from "@/components/project/project-form";
import { LinksField } from "@/components/ui/links-field";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import { initialFormState, type FormState } from "@/lib/form-state";
import { LIMITS } from "@/lib/validation";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/",
}));

type Member = components["schemas"]["Member"];
type Project = components["schemas"]["Project"];

const messages = { fa, en };

// NextIntlClientProvider types its children as a required prop; the lint rule
// wants them as a createElement argument, so give the provider a children-free type.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

function render(locale: Locale, element: ReactElement) {
  return renderToStaticMarkup(
    createElement(Provider, { locale, messages: messages[locale] }, element),
  );
}

function visibleText(html: string) {
  return html.replace(/<[^>]*>/g, " ");
}

function collapsed(html: string) {
  return visibleText(html).replace(/\s+/g, " ");
}

const noop = async (state: FormState) => state;

const sara = { handle: "sara", displayName: "سارا رحیمی" };
const kian = { handle: "kian", displayName: "کیان نوری" };

const member: Member = {
  handle: "sara",
  displayName: "سارا رحیمی",
  bio: "طراح و برنامه‌نویس",
  links: [{ label: "Website", url: "https://example.com" }],
  invitedBy: { handle: "kian", displayName: "کیان نوری" },
  joinedAt: "2024-03-02T08:00:00Z",
};

const project: Project = {
  slug: "daftar",
  name: "دفتر",
  oneLiner: "دفترچه‌ی کار مشترک",
  stage: "building",
  visibility: "members",
  links: [{ label: "Repo", url: "https://example.com/daftar" }],
  owners: [sara, kian],
  createdAt: "2026-10-17T08:00:00Z",
  updatedAt: "2026-10-17T08:00:00Z",
};

function tagsOf(html: string, tag: string) {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "g"))].map((match) => match[0]);
}

// The visible field of that name; hidden inputs are read through tagsOf.
function inputNamed(html: string, name: string) {
  return tagsOf(html, "input").find(
    (tag) => tag.includes(`name="${name}"`) && !tag.includes('type="hidden"'),
  );
}

describe("formatDate", () => {
  const iso = "2026-10-17T08:00:00Z";

  it("leaves out the year in the current year and shows it otherwise", () => {
    expect(formatDate(iso, "fa", new Date("2026-11-01T00:00:00Z"))).toBe("۲۵ مهر");
    expect(formatDate(iso, "fa", new Date("2027-11-01T00:00:00Z"))).toBe("۲۵ مهر ۱۴۰۵");
    expect(formatDate(iso, "en", new Date("2026-11-01T00:00:00Z"))).toBe("17 Oct");
    expect(formatDate(iso, "en", new Date("2027-11-01T00:00:00Z"))).toBe("17 Oct 2026");
  });
});

describe("MemberHead", () => {
  it("puts the handle in a left-to-right bdi", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(locale, createElement(MemberHead, { member, locale, isSelf: false }));

      expect(html).toContain('<bdi dir="ltr">@sara</bdi>');
    }
  });

  it("links the inviter to their page, with the locale prefix in English", () => {
    const fromFa = render("fa", createElement(MemberHead, { member, locale: "fa", isSelf: false }));
    const fromEn = render("en", createElement(MemberHead, { member, locale: "en", isSelf: false }));

    expect(fromFa).toMatch(/<a[^>]*href="\/members\/kian"[^>]*><bdi>کیان نوری<\/bdi><\/a>/);
    expect(fromEn).toMatch(/<a[^>]*href="\/en\/members\/kian"[^>]*><bdi>کیان نوری<\/bdi><\/a>/);
    expect(collapsed(fromFa)).toContain(fa.Profile.invitedBy.replace("{name}", "کیان نوری"));
    expect(collapsed(fromEn)).toContain(en.Profile.invitedBy.replace("{name}", "کیان نوری"));
  });

  it("says founding member when nobody invited them", () => {
    const founder = { ...member, invitedBy: null };

    for (const locale of ["fa", "en"] as const) {
      const html = render(locale, createElement(MemberHead, { member: founder, locale, isSelf: false }));

      expect(visibleText(html)).toContain(messages[locale].Profile.founding);
      expect(html).not.toContain("/members/kian");
    }
  });

  it("shows the edit link only to the member themselves", () => {
    for (const locale of ["fa", "en"] as const) {
      const prefix = locale === "fa" ? "" : "/en";
      const others = render(locale, createElement(MemberHead, { member, locale, isSelf: false }));
      const own = render(locale, createElement(MemberHead, { member, locale, isSelf: true }));

      expect(others).not.toContain("/me/edit");
      expect(own).toMatch(new RegExp(`<a[^>]*href="${prefix}/me/edit"[^>]*>`));
      expect(visibleText(own)).toContain(messages[locale].Profile.edit);
    }
  });

  it("shows no digits except those of the joined date", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(locale, createElement(MemberHead, { member, locale, isSelf: true }));
      const text = visibleText(html).replace(formatDate(member.joinedAt, locale), "");

      expect(visibleText(html)).toContain(formatDate(member.joinedAt, locale));
      expect(text).not.toMatch(/[0-9۰-۹٠-٩]/);
    }
  });
});

describe("ProjectCard", () => {
  it("is one link to the project page", () => {
    for (const locale of ["fa", "en"] as const) {
      const prefix = locale === "fa" ? "" : "/en";
      const html = render(locale, createElement(ProjectCard, { project, locale }));

      expect(tagsOf(html, "a")).toHaveLength(1);
      expect(html).toMatch(
        new RegExp(`<a[^>]*href="${prefix}/projects/daftar"[^>]*><bdi>دفتر</bdi></a>`),
      );
    }
  });

  it("joins the owners with the separator of the language", () => {
    const faHtml = render("fa", createElement(ProjectCard, { project, locale: "fa" }));
    const enHtml = render("en", createElement(ProjectCard, { project, locale: "en" }));

    expect(faHtml).toContain("<bdi>سارا رحیمی</bdi>، <bdi>کیان نوری</bdi>");
    expect(enHtml).toContain("<bdi>سارا رحیمی</bdi>, <bdi>کیان نوری</bdi>");
  });

  it("shows the public badge only for a public project", () => {
    for (const locale of ["fa", "en"] as const) {
      const closed = render(locale, createElement(ProjectCard, { project, locale }));
      const open = render(
        locale,
        createElement(ProjectCard, { project: { ...project, visibility: "public" }, locale }),
      );
      const label = messages[locale].PublicBadge.public;

      expect(visibleText(closed)).not.toContain(label);
      expect(visibleText(open)).toContain(label);
    }
  });

  it("translates the stage", () => {
    for (const locale of ["fa", "en"] as const) {
      for (const stage of ["idea", "building", "launched"] as const) {
        const html = render(
          locale,
          createElement(ProjectCard, { project: { ...project, stage }, locale }),
        );

        expect(visibleText(html)).toContain(messages[locale].Projects.stages[stage]);
      }
    }
  });
});

describe("LinksField", () => {
  const field = (locale: Locale, props: Partial<ComponentProps<typeof LinksField>> = {}) =>
    render(
      locale,
      createElement(LinksField, {
        links: [],
        errors: {},
        idPrefix: "links",
        max: LIMITS.linksMax,
        ...props,
      }),
    );

  it("renders one labelled row per allowed link and prefills the given ones", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = field(locale, { links: member.links });

      for (let i = 0; i < LIMITS.linksMax; i += 1) {
        expect(inputNamed(html, `links.${i}.label`)).toBeDefined();
        expect(inputNamed(html, `links.${i}.url`)).toBeDefined();
      }
      expect(inputNamed(html, `links.${LIMITS.linksMax}.label`)).toBeUndefined();
      expect(inputNamed(html, "links.0.label")).toContain('value="Website"');
      expect(inputNamed(html, "links.0.url")).toContain('value="https://example.com"');
      expect(inputNamed(html, "links.1.label")).toContain('value=""');
    }
  });

  it("shows the incomplete-row error on the field that is missing", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = field(locale, {
        links: [{ label: "Website", url: "" }],
        errors: { "links.0": { key: "linkIncomplete" } },
      });
      const message = messages[locale].Forms.errors.linkIncomplete;
      const urlTag = inputNamed(html, "links.0.url") ?? "";
      const labelTag = inputNamed(html, "links.0.label") ?? "";

      expect(visibleText(html).split(message)).toHaveLength(2);
      expect(urlTag).toContain("aria-invalid");
      expect(labelTag).not.toContain("aria-invalid");
    }
  });
});

describe("OwnerManager", () => {
  const manager = (locale: Locale, owners: (typeof sara)[]) =>
    render(
      locale,
      createElement(OwnerManager, { owners, addAction: noop, removeAction: noop }),
    );

  it("offers no remove button for the only owner", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = manager(locale, [sara]);

      expect(inputNamed(html, "handle")).toContain('dir="ltr"');
      expect(tagsOf(html, "form")).toHaveLength(1);
      expect(html.match(/type="hidden"/g)).toBeNull();
    }
  });

  it("offers a remove form carrying the handle for each of two owners", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = manager(locale, [sara, kian]);
      const hidden = tagsOf(html, "input").filter((tag) => tag.includes('type="hidden"'));

      expect(tagsOf(html, "form")).toHaveLength(3);
      expect(hidden.map((tag) => /value="([^"]*)"/.exec(tag)?.[1])).toEqual(["sara", "kian"]);
      for (const tag of hidden) expect(tag).toContain('name="handle"');
      expect(inputNamed(html, "handle")).toContain('dir="ltr"');
    }
  });
});

describe("ProfileForm", () => {
  it("renders every field with the member's values", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(
        locale,
        createElement(ProfileForm, { member, linksMax: LIMITS.linksMax, action: noop }),
      );

      expect(inputNamed(html, "handle")).toContain('value="sara"');
      expect(inputNamed(html, "displayName")).toContain('value="سارا رحیمی"');
      expect(html).toMatch(/<textarea[^>]*name="bio"[^>]*>طراح و برنامه‌نویس<\/textarea>/);
      expect(inputNamed(html, "links.0.url")).toContain('value="https://example.com"');
      expect(visibleText(html)).toContain(messages[locale].Forms.save);
    }
  });
});

describe("ProjectForm", () => {
  it("renders every field with the project's values in update mode, without a slug", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(
        locale,
        createElement(ProjectForm, {
          mode: "update",
          project,
          linksMax: LIMITS.linksMax,
          action: noop,
        }),
      );

      expect(inputNamed(html, "name")).toContain('value="دفتر"');
      expect(inputNamed(html, "oneLiner")).toContain('value="دفترچه‌ی کار مشترک"');
      expect(inputNamed(html, "slug")).toBeUndefined();
      expect(html).toMatch(/<option value="building" selected="">/);
      expect(html).toMatch(/<option value="members" selected="">/);
      expect(inputNamed(html, "links.0.label")).toContain('value="Repo"');
    }
  });

  it("asks for a slug in create mode", () => {
    const html = render(
      "en",
      createElement(ProjectForm, { mode: "create", linksMax: LIMITS.linksMax, action: noop }),
    );

    expect(inputNamed(html, "slug")).toContain('dir="ltr"');
    expect(inputNamed(html, "name")).toContain('value=""');
    expect(initialFormState.errors).toEqual({});
  });
});
