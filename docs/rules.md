# Rules the platform computes

Workaholics has no hosts or judges above its members. The rules that shape what the site shows are therefore written here, in public, so every member can read them and propose changes. Changing a rule means changing both this file and the platform. Abuse-prevention thresholds are the one exception: they stay private because publishing them would make them useless.

## What the site never computes

- No votes, likes, follower counts, karma or reputation.
- No leaderboards, rankings or "featured" picks.
- No score for a member, a project or a piece of feedback.
- No per-owner response rates or streaks.

## Visibility

- Everything a member posts is visible **only to members** by default.
- The owner of a project can make the project public. An owner can also make a single post public, or keep one post members-only inside a public project.
- Public pages show only what the owner made public.
- Until public pages ship, every post and every piece of feedback is visible only to members.

## Answering feedback

- Every piece of feedback is either **awaiting response** or **answered**.
- Anyone in the community except the project's owners can give feedback on a post, and can say which of the post's questions it answers.
- An owner answers with one of three statuses, always with a reason:
  - **accepted**: the owner will act on it;
  - **rejected**: the owner will not, and says why;
  - **testing**: the owner is trying it, and gives a date to report back, from tomorrow up to 180 days ahead. To report back, the owner gives a new answer.
- "Awaiting response" is never stored. It is worked out from the time since the feedback was given.
- **Days are counted in whole 24-hour periods** from the moment the feedback was given, so they are the same in every time zone. An answer within the first 24 hours is "answered the same day".
- **The response window is 7 days.** An item awaiting response for more than 7 days shows how long it has been overdue, for example "5 days overdue". An answered item shows how long the owner's **first** answer took, for example "answered in 3 days": that is when the loop closed. An owner can change the answer later; earlier answers stay visible in its history.
- **On day 5** of an unanswered item, the project's owners get a reminder.
- Nothing closes, expires or is declined automatically. An unanswered item stays visibly unanswered until the owner answers it.
- When the owner answers, the person who gave the feedback is told. The giver and the owners can reply under the feedback.

## Editing

- The author of a post, a piece of feedback, an answer or a reply can edit it for **15 minutes** after writing it. An answer can be edited only while it is the current one.
- An edited item shows that it was edited. Edits notify no one.
- Nothing can be deleted.

## Notifications

- The notifications page tells you when someone gives feedback on your project, when an owner answers your feedback, when someone replies to you, and when feedback on your project has waited 5 days.
- The site never shows a count of unread notifications, and the header never shows a dot or a "new" marker.
- You can also get notifications as private Telegram messages: start the Workaholics bot (the same bot you sign in with), and send /stop to turn them off. Only notifications made after you started the bot are sent, and none older than a day.

## The weekly digest

- Every Monday at 09:00 Tehran time, each member who started the bot gets one private message: the work posted in the past week and the feedback still waiting for an answer, in random order, with no numbers.
- When someone posts an update, it is announced in the members-only Telegram group once its 15-minute edit window closes, so members see each other working.
- A public version of the digest comes later.

More rules (monthly practice numbers, invitations) are added here as each part of the platform ships.
