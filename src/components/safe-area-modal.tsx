import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type KeyboardAvoidingViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Radius, Shadows, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type SafeAreaModalProps = {
  androidKeyboardBehavior?: KeyboardAvoidingViewProps["behavior"];
  androidPresentation?: "center" | "sheet";
  children: ReactNode;
  onRequestClose: () => void;
  visible: boolean;
};

/**
 * The only blocking modal presentation used by the app.
 *
 * Every iOS overlay is centered inside the visible safe area and scrolls
 * internally when its content is too tall. Android may retain a centered or
 * bottom-sheet presentation per screen.
 */
export function SafeAreaModal({
  androidKeyboardBehavior,
  androidPresentation = "sheet",
  children,
  onRequestClose,
  visible,
}: SafeAreaModalProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const isCentered = Platform.OS === "ios" || androidPresentation === "center";

  return (
    <Modal
      animationType="slide"
      onRequestClose={onRequestClose}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : androidKeyboardBehavior}
        style={[styles.backdrop, !isCentered && styles.sheetBackdrop]}
      >
        <ScrollView
          contentContainerStyle={[
            isCentered ? styles.centeredViewport : styles.sheetViewport,
            isCentered && {
              paddingBottom: Spacing.lg + insets.bottom,
              paddingTop: Spacing.lg + insets.top,
            },
          ]}
          contentInsetAdjustmentBehavior="never"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={!isCentered ? styles.sheetScroll : undefined}
        >
          <View
            accessibilityViewIsModal
            style={[
              styles.card,
              isCentered ? styles.centeredCard : styles.sheetCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              !isCentered && { paddingBottom: Spacing.lg + insets.bottom },
            ]}
          >
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.36)",
    flex: 1,
  },
  sheetBackdrop: { justifyContent: "flex-end" },
  centeredViewport: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  sheetViewport: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  sheetScroll: { maxHeight: "92%" },
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    width: "100%",
  },
  centeredCard: {
    alignSelf: "center",
    borderCurve: "continuous",
    borderRadius: Radius.lg,
    borderWidth: 1,
    boxShadow: Shadows.raised,
    maxWidth: 560,
  },
  sheetCard: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
});
