import { signUnsubscribeToken } from '../unsubscribe/unsubscribe-token.util';
import { buildVarsFromContact, renderTemplateString } from './template-render.util';

export type ContactWithId = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phone: string | null;
  tags: string[];
};

export interface ComplianceEmailOptions {
  unsubscribeSecret?: string;
  publicWebUrl?: string;
  unsubscribeTtlDays?: number;
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Renders subject/html/text with contact vars, adds signed {{unsubscribeUrl}} when configured,
 * and appends a minimal footer if the final body does not already contain the URL.
 */
export function buildEmailWithCompliance(
  subjectTpl: string,
  htmlTpl: string,
  textTpl: string | null,
  contact: ContactWithId,
  workspaceId: string,
  opts: ComplianceEmailOptions,
  sample?: Record<string, string>,
): { subject: string; html: string; text: string | undefined } {
  const vars = buildVarsFromContact(contact, sample);

  if (opts.unsubscribeSecret && opts.publicWebUrl && contact.id) {
    const token = signUnsubscribeToken(
      contact.id,
      workspaceId,
      opts.unsubscribeSecret,
      opts.unsubscribeTtlDays,
    );
    const base = opts.publicWebUrl.replace(/\/$/, '');
    // Always set from server; do not allow sampleVariables to forge unsubscribe links.
    vars.unsubscribeUrl = `${base}/unsubscribe?token=${encodeURIComponent(token)}`;
  }

  let html = renderTemplateString(htmlTpl, vars);
  let text = textTpl ? renderTemplateString(textTpl, vars) : undefined;
  const url = vars.unsubscribeUrl;

  if (url) {
    if (!html.includes(url)) {
      html += `<p style="margin-top:24px;font-size:12px;color:#6b7280"><a href="${escapeHtmlAttr(url)}">Unsubscribe</a></p>`;
    }
    if (text !== undefined && !text.includes(url)) {
      text += `\n\nUnsubscribe: ${url}`;
    }
  }

  const subject = renderTemplateString(subjectTpl, vars);
  return { subject, html, text };
}
