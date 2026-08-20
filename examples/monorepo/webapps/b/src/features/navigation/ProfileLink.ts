import { useProfileUrl } from "@/features/navigation/use-profile-url";
import { messages } from "@/i18n";

export function ProfileLink(): string {
  return `${messages.goTo}: ${useProfileUrl()}`;
}
