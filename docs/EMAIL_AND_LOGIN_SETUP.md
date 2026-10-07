# Email and login setup (production)

Production project: `rzkybmkzhpwovpvrjkxk`. App: `https://app.funda360.aurisnexus.co.za`.

These settings live in the Supabase dashboard, not in the repository. `supabase/config.toml` only configures the local stack.

## What was wrong (auth logs, 2026-10-07)

- **Site URL was `http://localhost:3000`.** A password-reset email was sent and the link was used, but Supabase sent the browser to `localhost:3000`, a page that does not exist. The account stayed without a usable password.
- **Emails came from `noreply@mail.app.supabase.io`.** That is Supabase's built-in test mailer. It sends about 2 emails per hour and only to members of the Supabase organisation. Parents, staff and learners never receive it.
- **Links only worked in the browser that asked for them.** The app uses the PKCE flow, so `{{ .ConfirmationURL }}` links fail on another device. A guardian invitation is always requested from the admin's browser, so every guardian activation failed. The app now accepts `?token_hash=…&type=…` links, which work in any browser, but the production email template must be changed to send them (step 3).

## 1. URL configuration

Dashboard → Authentication → URL Configuration.

- **Site URL:** `https://app.funda360.aurisnexus.co.za`
- **Redirect URLs** (add each one):
  - `https://app.funda360.aurisnexus.co.za/reset-password`
  - `https://app.funda360.aurisnexus.co.za/activate-account`
  - `https://app.funda360.aurisnexus.co.za/**`
  - `http://localhost:5173/**` (local development only)

## 2. SMTP (custom email sender)

Dashboard → Authentication → Emails → SMTP Settings → enable custom SMTP.

| Field                          | Value                                     |
| ------------------------------ | ----------------------------------------- |
| Sender email                   | `onboarding@aurisnexus.co.za`             |
| Sender name                    | `Funda360`                                |
| Host                           | `smtp.hmailplus.com`                      |
| Port                           | `587`                                     |
| Username                       | the real HostAfrica mailbox address       |
| Password                       | that mailbox's password                   |
| Minimum interval between emails | `1` second (or leave the default `60`)    |

Never put the username or password in this repository: it is public.

Then Dashboard → Authentication → Rate Limits → **Rate limit for sending emails**: raise from 2 to at least `100` per hour, so a school can invite a class of guardians.

Deliverability (in the `aurisnexus.co.za` DNS at HostAfrica):

- SPF must include the HostAfrica mail servers (HostAfrica support will give the exact `include:`).
- Turn on DKIM for the domain in the HostAfrica panel.
- Add a DMARC record, for example `_dmarc TXT "v=DMARC1; p=none; rua=mailto:onboarding@aurisnexus.co.za"`.

Without these, Gmail and Outlook may put Funda360 emails in spam.

## 3. Email template: Reset password

Dashboard → Authentication → Emails → Templates → **Reset Password**.

- **Subject:** `Continue to your Funda360 account`
- **Body:** paste the contents of `supabase/templates/recovery.html`.

The important line is the button link:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">
```

Do not use `{{ .ConfirmationURL }}`: with PKCE it only works in the browser that requested the email.

This one template serves both staff "Forgot password" and guardian account activation. The app sends a different redirect for each.

## 4. Other Auth settings

- Authentication → Providers → Email: **Confirm email** may stay on. Accounts are created by schools, not by public sign-up.
- Authentication → Attack Protection: turn on **leaked-password protection**.
- Authentication → Sign In / Providers: consider turning **Allow new users to sign up** off. All accounts are provisioned by school owners or platform admins.

## 5. Test it

1. Open `https://app.funda360.aurisnexus.co.za/forgot-password` and request a reset for your own address.
2. Auth logs (Dashboard → Logs → Auth) should show `mail.send` with `mail_from` = `onboarding@aurisnexus.co.za`, not `noreply@mail.app.supabase.io`.
3. Open the email **on a different device** (for example your phone). The button should open `/reset-password` with the "Set a new password" form.
4. Set a password and sign in at `/login`.
5. From a school admin account, send a guardian invitation to a second address you own, open it on another device, and activate it.

If the link opens the "invalid or has expired" notice, the link was already used or is older than one hour. Request a new one.
