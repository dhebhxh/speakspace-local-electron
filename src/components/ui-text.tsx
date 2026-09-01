import { Children, type ComponentProps, type ReactNode } from "react";
import { Text as NativeText } from "react-native";
import { useTranslation } from "react-i18next";

import type { UiLanguage } from "@/localization/i18n";
import { translateUiCopy } from "@/localization/ui-copy";

type Props = ComponentProps<typeof NativeText>;

export function UiText({ children, ...props }: Props) {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ?? "en") as UiLanguage;

  const translated = Children.map(children, (child): ReactNode =>
    typeof child === "string" ? translateUiCopy(child, language) : child,
  );

  return <NativeText {...props}>{translated}</NativeText>;
}
