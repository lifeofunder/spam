/**
 * Cloudflare Turnstile (optional anti-abuse).
 *
 * When you add a site key to the web app, render the widget and pass `turnstileToken`
 * in `POST /auth/register` and `POST /auth/forgot-password` bodies. The API enforces
 * verification when `TURNSTILE_SECRET_KEY` is set.
 *
 * Docs: https://developers.cloudflare.com/turnstile/
 */
export const TURNSTILE_WIDGET_TODO = true;
