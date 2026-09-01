import { type ComponentProps } from "react";
import { TextInput as NativeTextInput } from "react-native";
import { useTranslation } from "react-i18next";

import type { UiLanguage } from "@/localization/i18n";
import { translateUiCopy } from "@/localization/ui-copy";

type Props = ComponentProps<typeof NativeTextInput>;

export function UiTextInput({ placeholder, ...props }: Props) {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ?? "en") as UiLanguage;
  return <NativeTextInput {...props} placeholder={placeholder ? translateUiCopy(placeholder, language) : undefined} />;
}
