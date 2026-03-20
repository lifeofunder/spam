type ContactLike = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phone: string | null;
  tags: string[];
};

const EMPTY_DEFAULTS: Record<string, string> = {
  email: '',
  firstName: '',
  lastName: '',
  fullName: '',
  company: '',
  phone: '',
  tags: '',
  unsubscribeUrl: '',
};

export function buildVarsFromContact(
  contact: ContactLike,
  sample?: Record<string, string>,
): Record<string, string> {
  const firstName = contact.firstName ?? '';
  const lastName = contact.lastName ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const base: Record<string, string> = {
    email: contact.email,
    firstName,
    lastName,
    fullName,
    company: contact.company ?? '',
    phone: contact.phone ?? '',
    tags: contact.tags.join(', '),
  };
  if (sample) {
    for (const [k, v] of Object.entries(sample)) {
      if (v !== undefined && v !== null) {
        base[k] = String(v);
      }
    }
  }
  return base;
}

export function buildVarsFromSampleOnly(sample?: Record<string, string>): Record<string, string> {
  return { ...EMPTY_DEFAULTS, ...sample };
}

/** Replaces `{{varName}}` placeholders (word chars and dots). */
export function renderTemplateString(content: string, vars: Record<string, string>): string {
  return content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
}
