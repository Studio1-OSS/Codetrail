// The landing page, the browse and data pages, and every repo traced on this instance (public ones only).
import type { MetadataRoute } from "next";
import { env } from "@/env";
import { getRecent } from "@/server/trail/service";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const recent = await getRecent().catch(() => []);
  return [
    { url: env.SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${env.SITE_URL}/browse`, changeFrequency: "daily", priority: 0.6 },
    { url: `${env.SITE_URL}/data`, changeFrequency: "daily", priority: 0.5 },
    ...recent.filter((r) => !r.private).map((r) => ({ url: `${env.SITE_URL}/${r.owner}/${r.repo}`, lastModified: new Date(r.at), changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
