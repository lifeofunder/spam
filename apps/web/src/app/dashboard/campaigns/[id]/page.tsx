import CampaignDetailPageClient from './campaign-detail-page.client';

/** Placeholder id so `output: export` prerenders ≥1 path (Next 15 rejects empty `generateStaticParams` for export). */
export function generateStaticParams(): { id: string }[] {
  return [{ id: '__' }];
}

export const dynamicParams = false;

export default function CampaignDetailPage() {
  return <CampaignDetailPageClient />;
}
