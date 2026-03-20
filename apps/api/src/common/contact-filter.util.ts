import { ContactStatus, Prisma } from '@prisma/client';

export interface ContactFilterOptions {
  query?: string;
  tag?: string;
  subscribedOnly?: boolean;
}

export function buildContactWhere(
  workspaceId: string,
  opts: ContactFilterOptions,
): Prisma.ContactWhereInput {
  const q = opts.query?.trim();
  const tag = opts.tag?.trim();

  return {
    workspaceId,
    ...(opts.subscribedOnly ? { status: ContactStatus.SUBSCRIBED } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { company: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}
