import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appContainer } from "@/application";
import { AppButton } from "@/components/app-button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { WorkspaceCard } from "@/components/workspace-card";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { ValidationError } from "@/errors/validation-error";
import { useTheme } from "@/hooks/use-theme";

type WorkspaceListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      workspaces: Awaited<
        ReturnType<typeof appContainer.workspaceService.getWorkspaces>
      >;
    };

export default function WorkspacesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const insets = useSafeAreaInsets();
  const { workspaceService } = appContainer;
  const [state, setState] = useState<WorkspaceListState>({
    status: "loading",
  });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadWorkspaces = async () => {
    setState({ status: "loading" });

    try {
      setState({
        status: "success",
        workspaces: await workspaceService.getWorkspaces(),
      });
    } catch {
      setState({ status: "error", message: "Unable to load workspaces." });
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadWorkspaces();
    }, []),
  );

  const createWorkspace = async () => {
    setFormError(null);
    setIsSaving(true);

    try {
      await workspaceService.createWorkspace(name);
      setName("");
      setIsModalVisible(false);
      await loadWorkspaces();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof ValidationError
          ? caughtError.message
          : "Unable to create workspace.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Workspaces" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Spacing.xxl + insets.bottom },
        ]}
      >
        <View style={styles.headingRow}>
          <View style={styles.heading}>
            <Text style={[styles.kicker, { color: colors.accent }]}>
              YOUR LIBRARY
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              Workspaces
            </Text>
          </View>
          <View style={styles.headingActions}>
            <AppButton label="Search" variant="secondary" onPress={() => router.push("/notes/search")} />
            <AppButton label="New" onPress={() => setIsModalVisible(true)} />
          </View>
        </View>

        {state.status === "loading" && <LoadingState />}
        {state.status === "error" && (
          <ErrorState
            message={state.message}
            onRetry={() => void loadWorkspaces()}
          />
        )}
        {state.status === "success" && state.workspaces.length === 0 && (
          <EmptyState
            title="No workspaces yet"
            action={
              <AppButton
                label="Create workspace"
                onPress={() => setIsModalVisible(true)}
              />
            }
          />
        )}
        {state.status === "success" && state.workspaces.length > 0 && (
          <View style={styles.list}>
            {state.workspaces.map((workspace) => (
              <WorkspaceCard
                key={workspace.getId()}
                workspace={workspace}
                onPress={() =>
                  router.push({
                    pathname: "/workspaces/[workspaceId]",
                    params: { workspaceId: workspace.getId() },
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <ScrollView
            contentContainerStyle={[
              styles.modal,
              {
                backgroundColor: colors.surface,
                paddingBottom: Spacing.lg + insets.bottom,
              },
            ]}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                New workspace
              </Text>
              <Pressable
                hitSlop={10}
                onPress={() => {
                  Keyboard.dismiss();
                  setIsModalVisible(false);
                }}
                accessibilityLabel="Close"
              >
                <Text style={[styles.close, { color: colors.textMuted }]}>
                  Close
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.label, { color: colors.textMuted }]}>
              Name
            </Text>
            <TextInput
              autoFocus
              placeholder="e.g. Personal"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.text },
              ]}
            />
            {formError && (
              <Text style={[styles.formError, { color: colors.danger }]}>
                {formError}
              </Text>
            )}
            <AppButton
              label={isSaving ? "Creating..." : "Create workspace"}
              disabled={isSaving}
              onPress={() => void createWorkspace()}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.xl, padding: Spacing.lg },
  headingRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heading: { gap: Spacing.xs },
  headingActions: { flexDirection: "row", gap: Spacing.sm },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 34, fontWeight: "800" },
  list: { gap: Spacing.md },
  modalBackdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.36)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modal: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 23, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700" },
  label: { fontSize: 14, fontWeight: "700" },
  input: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
  },
  formError: { fontSize: 14 },
});
