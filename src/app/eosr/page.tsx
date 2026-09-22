import { redirect } from "next/navigation";

export default async function Page() {
  // Keep historic guard bookmarks compatible without retaining a second writer.
  redirect("/reporting#shift-closeout");
}
