# Post

A post on a project: work in progress («نصفه‌کاره») asks for feedback, an update («به‌روزرسانی») reports what changed because of it.

**Provide:** `kind` (`wip` or `update`), author, `created_at`, `body`, `feedback_wanted` (a list of questions), optional `self_critique`, visibility, and for updates the template fields: what changed, the feedback items acted on (each with its answer tag), what was rejected and why, and one number in the owner's own words.

**States:** work in progress, update, public post (Public badge in the head row), members-only post inside a public project (Members only label), compact (in the timeline: self-critique hidden).

**Rules**
- `bg-sheet`, `border border-rule`, `rounded-md`, padding `spacing-6`. The head row shows the kind with its icon (`file-pen-line` or `file-diff`), the author and the date.
- «چه بازخوردی می‌خواهم» sits in a `bg-sunken` well. It is the most important part of a work-in-progress post; givers answer it.
- The update's sections follow the platform's template in order. "One number" is a sentence the owner writes, set as body text. Never turn it into a big-number tile, a chart or a delta arrow.
- The footer links to the feedback thread and offers «بازخورد بدهید» to members who are not owners. It never shows how many pieces of feedback there are.
