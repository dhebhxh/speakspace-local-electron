import { Alert as NativeAlert, type AlertButton, type AlertOptions } from "react-native";

import { i18n, type UiLanguage } from "@/localization/i18n";
import { translateUiCopy } from "@/localization/ui-copy";

function tr(value: string | undefined): string | undefined {
  return value ? translateUiCopy(value, (i18n.resolvedLanguage ?? "en") as UiLanguage) : value;
}

export const UiAlert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    NativeAlert.alert(
      tr(title) ?? title,
      tr(message),
      buttons?.map((button) => ({ ...button, text: tr(button.text) })),
      options,
    );
  },
  prompt: NativeAlert.prompt.bind(NativeAlert),
};
