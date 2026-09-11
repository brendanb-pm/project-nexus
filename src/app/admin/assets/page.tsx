import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { AssetInventory } from "@/components/admin/asset-inventory";
import { loadAssetPage } from "@/features/assets/application";
import { createAssetService } from "@/features/assets/server";
import * as actions from "./actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string; new?: string }>;
}) {
  const params = await searchParams;
  const state = await loadAssetPage(
    createAssetService(
      await createProductionPrincipalResolver(),
      "assets.page",
    ),
    params.asset,
    params.new === "1",
  );
  return (
    <AssetInventory
      state={state}
      actions={{
        createAsset: actions.createAsset,
        updateAsset: actions.updateAsset,
      }}
    />
  );
}
