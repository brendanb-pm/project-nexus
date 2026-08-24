import { ClientAdmin } from "@/components/admin/client-admin";
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <ClientAdmin state={{ kind: "loading" }} />
    </main>
  );
}
