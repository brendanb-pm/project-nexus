import { notFound } from "next/navigation";
import { PrototypeScreen } from "../prototype";
import { prototypeScreens, type PrototypeScreenId } from "../prototype-data";

export function generateStaticParams() {
  return prototypeScreens.map(({ id }) => ({ screen: id }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!prototypeScreens.some(({ id }) => id === screen)) notFound();
  return <PrototypeScreen screen={screen as PrototypeScreenId} />;
}
