import { SitePostAdmin } from "@/components/admin/site-post-admin";
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <SitePostAdmin state={{ kind: "loading" }} />
    </main>
  );
}
