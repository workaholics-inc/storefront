# SignIn

Sign-in for an invite-only community: Telegram for members, then an invite code for people joining.

**Sections:** title «ورود به Workaholics» and one sentence on invitations · «ورود با تلگرام» (primary, full width, `send` icon) with a hint that the person goes to Telegram and comes back · divider «دعوت‌نامه دارید؟» · invite code field (LTR, normalise digits) and «ادامه» · a line pointing non-members to the manifesto.

**Rules:** prefer Telegram's redirect login (a plain link to Telegram's own authorisation page that returns to the storefront) over the embedded login widget, so no third-party script runs on the storefront; confirm the flow with the platform's verification before building it. Never ask for a password. Error states use FormField (invalid or used invite code) and StateMessage (platform unreachable).
