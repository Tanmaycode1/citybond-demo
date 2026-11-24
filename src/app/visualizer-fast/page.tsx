import { getPublicContent } from "@/lib/cms/content";
import { NeutralWallVisualizer } from "@/components/site/NeutralWallVisualizer";
import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata = { title: "Exterior material visualizer | CityBond", robots: { index: false, follow: false } };
export default async function FastVisualizerPage() {
  const content = await getPublicContent();
  return <main><header className="fv-review-header"><strong>CITYBOND</strong><Link href="/third-eye-view">Back to Third Eye View</Link></header><NeutralWallVisualizer content={content}/></main>;
}
