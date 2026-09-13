import { isLocalDevelopmentAuthEnabled } from "@/auth/development";
import { DevelopmentSignOut } from "./development-sign-out";
import { SignOutButton } from "./sign-out-button";

export function SessionSignOut() {
  return isLocalDevelopmentAuthEnabled() ? (
    <DevelopmentSignOut />
  ) : (
    <SignOutButton />
  );
}
