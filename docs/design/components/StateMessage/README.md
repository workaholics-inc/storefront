# StateMessage

What a page or section shows when there is nothing to show, something failed, the platform can't be reached, or the content is for members only.

**Provide:** the kind (`empty`, `error`, `unreachable`, `members-only`), a title, one or two sentences, an optional action, and for errors the platform's error code.

**States:** empty (dashed border, `inbox` or `message-square-text`, an action only when the viewer can fix it, such as «پروژه‌ی تازه»); error (`color-danger` border on `bg-danger-soft`, `circle-alert`, the code in `font-mono`, «دوباره امتحان کن»); platform unreachable (solid `color-rule-strong` border on `bg-sheet`, `cloud-off`, keeps whatever the person typed on the page); members-only (`lock`, «ورود»).

**Rules**
- Align to the inline start inside its section; never centre a whole page around an empty state.
- Write what happened and what to do next. No apologies, no jokes, no illustrations.
- Map the platform's `error.code` to a translated message; show the raw code only as a small reference line.
- "Platform unreachable" is not an error the person caused. Never clear a form when it happens.
