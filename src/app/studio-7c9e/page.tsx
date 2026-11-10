import { isEditor } from "@/lib/cms/auth";
import { Portal } from "@/components/portal/Portal";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "CityBond Content Studio",
  robots: { index: false, follow: false },
};
export default async function Studio() {
  return <Portal authenticated={await isEditor()} />;
}
