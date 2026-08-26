import { type Href, useLocalSearchParams, useRouter } from "expo-router";

import { AppButton } from "@/components/app-button";

export function OnboardingModelBackButton() {
  const { fromGuide, guideReplay } = useLocalSearchParams<{
    fromGuide?: string;
    guideReplay?: string;
  }>();
  const router = useRouter();

  if (fromGuide !== "1") return null;

  return (
    <AppButton
      label="Back to Getting Started"
      variant="secondary"
      onPress={() => {
        router.replace(
          `/getting-started?step=2${guideReplay === "1" ? "&replay=1" : ""}` as Href,
        );
      }}
    />
  );
}
