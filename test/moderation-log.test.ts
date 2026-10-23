import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import { ModerationLog } from "@/components/moderation/moderation-log";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";

type Entry = components["schemas"]["ModerationLogEntry"];

const current = vi.hoisted(() => ({ path: "/" }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => current.path,
}));

const messages = { fa, en };
const prefixes = { fa: "", en: "/en" } as const;

// NextIntlClientProvider types its children as a required prop; the lint rule
// wants them as a createElement argument, so give the provider a children-free type.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

function render(locale: Locale, entries: Entry[]) {
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: messages[locale] },
      createElement(ModerationLog, { entries, locale }),
    ),
  );
}

function visibleText(html: string) {
  return html.replace(/<[^>]*>/g, " ");
}

function collapsed(html: string) {
  return visibleText(html).replace(/\s+/g, " ");
}

// The markup escapes quotes and ampersands in text; the messages hold them raw.
function unescaped(text: string) {
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// An item's visible text, whitespace collapsed and entities decoded.
function textOf(html: string) {
  return unescaped(collapsed(html));
}

// An ICU message as the reader sees it: arguments replaced, <n> tags dropped.
function said(template: string, values: Record<string, string> = {}) {
  let out = template.replace(/<\/?n>/g, "");
  for (const [name, value] of Object.entries(values)) out = out.replace(`{${name}}`, value);
  return out;
}

// Text with its tags removed outright, where a bdi sits inside a sentence.
function joined(html: string) {
  return unescaped(html.replace(/<[^>]*>/g, ""));
}

function items(html: string) {
  return html.split("<li").slice(1);
}

const project = {
  slug: "daftar",
  name: "دفتر",
  owners: [{ handle: "sara", displayName: "سارا رحیمی" }],
};

const entries: Entry[] = [
  {
    id: "0199f1a2-7c3e-7a10-8000-000000000701",
    action: "hidden",
    targetKind: "post",
    project,
    reason: "Spam link (test)",
    role: "moderator",
    at: "2026-12-07T10:00:00.000Z",
  },
  {
    id: "0199f1a2-7c3e-7a10-8000-000000000702",
    action: "restored",
    targetKind: "feedback",
    project,
    reason: "Reviewed again (test)",
    role: "admin",
    at: "2026-12-06T10:00:00.000Z",
  },
  {
    id: "0199f1a2-7c3e-7a10-8000-000000000703",
    action: "hidden",
    targetKind: "reply",
    project,
    reason: "Off-topic (test)",
    role: "moderator",
    at: "2026-12-05T10:00:00.000Z",
  },
  {
    id: "0199f1a2-7c3e-7a10-8000-000000000704",
    action: "role_granted",
    targetKind: "role",
    project: null,
    reason: "Second admin for launch (test)",
    role: "admin",
    at: "2026-12-04T10:00:00.000Z",
  },
  {
    id: "0199f1a2-7c3e-7a10-8000-000000000705",
    action: "role_revoked",
    targetKind: "role",
    project: null,
    reason: "Stepped down (test)",
    role: "moderator",
    at: "2026-12-03T10:00:00.000Z",
  },
];

const [entry1, , , entry4] = entries as [Entry, Entry, Entry, Entry, Entry];

function sentences(locale: Locale) {
  const m = messages[locale].ModerationLog;

  return [
    said(m.hidden, { actor: m.actorModerator, item: m.itemPost }),
    said(m.restored, { actor: m.actorAdmin, item: m.itemFeedback }),
    said(m.hidden, { actor: m.actorModerator, item: m.itemReply }),
    said(m.roleGranted, { role: m.roleAdmin }),
    said(m.roleRevoked, { role: m.roleModerator }),
  ];
}

describe("ModerationLog", () => {
  it("renders one item per entry, each saying what happened by role", () => {
    for (const locale of ["fa", "en"] as const) {
      const list = items(render(locale, entries));
      const expected = sentences(locale);

      expect(list).toHaveLength(5);
      list.forEach((item, index) => {
        expect(textOf(item)).toContain(expected[index]);
      });
    }
  });

  it("shows the reason in a bdi after the reason label", () => {
    for (const locale of ["fa", "en"] as const) {
      const list = items(render(locale, entries));
      const label = (messages[locale].ModerationLog.reason.split("<n>")[0] ?? "").trim();

      expect(label).not.toBe("");
      expect(list[0]).toContain("<bdi>Spam link (test)</bdi>");
      expect(textOf(list[0] ?? "")).toContain(label);
    }
  });

  it("links a project entry to its project and leaves role entries without a link", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(locale, entries);
      const list = items(html);
      const onProject = said(messages[locale].ModerationLog.onProject, { project: "دفتر" });

      for (const item of list.slice(0, 3)) {
        const anchors = item.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) ?? [];

        expect(item.match(/<a\b/g)).toHaveLength(1);
        expect(anchors).toHaveLength(1);
        expect(anchors[0]).toContain(`href="${prefixes[locale]}/projects/daftar"`);
        expect(joined(anchors[0] ?? "")).toBe(onProject);
      }
      for (const item of list.slice(3)) {
        expect(item).not.toContain("<a");
      }
      expect(html).toContain("<bdi>دفتر</bdi>");
    }
  });

  it("shows each entry's date", () => {
    for (const locale of ["fa", "en"] as const) {
      const list = items(render(locale, entries));

      entries.forEach((entry, index) => {
        expect(list[index]).toContain(formatDate(entry.at, locale));
      });
    }
  });

  it("names no person and links to no member", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(locale, entries);

      expect(html).not.toContain("سارا رحیمی");
      expect(html).not.toContain("/members/");
    }
  });

  it("keeps the platform's order and never sorts by date", () => {
    for (const locale of ["fa", "en"] as const) {
      const list = items(render(locale, [...entries].reverse()));
      const expected = sentences(locale);

      expect(list).toHaveLength(5);
      expect(textOf(list[0] ?? "")).toContain(expected[4]);
      expect(textOf(list[4] ?? "")).toContain(expected[0]);
      expect(list[0]).toContain(formatDate("2026-12-03T10:00:00.000Z", locale));
      expect(list[4]).toContain(formatDate("2026-12-07T10:00:00.000Z", locale));
    }
  });

  it("skips an entry that cannot occur instead of throwing", () => {
    const impossible: Entry = { ...entry1, targetKind: "role", project: null };

    for (const locale of ["fa", "en"] as const) {
      const list = items(render(locale, [impossible, entry4]));

      expect(list).toHaveLength(1);
      expect(textOf(list[0] ?? "")).toContain(sentences(locale)[3]);
    }
  });
});
