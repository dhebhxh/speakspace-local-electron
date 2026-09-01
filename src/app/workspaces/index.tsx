import { UiTextInput as TextInput } from "@/components/ui-text-input";
import { UiText as Text } from "@/components/ui-text";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appContainer } from "@/application";
import { AppButton } from "@/components/app-button";
import { SafeAreaModal } from "@/components/safe-area-modal";
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

export function WorkspaceListScreen({ embeddedInTab = false }: { embeddedInTab?: boolean }) {
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
      {!embeddedInTab && <Stack.Screen options={{ title: "Workspaces" }} />}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: Spacing.xxl + insets.bottom,
            paddingTop: embeddedInTab ? insets.top + Spacing.md : Spacing.lg,
          },
        ]}
      >
        <View style={styles.headingSection}>
          {embeddedInTab && (
            <View style={styles.heading}>
              <Text style={[styles.title, { color: colors.text }]}>Workspaces</Text>
              <Text style={[styles.workspaceSubtitle, { color: colors.textMuted }]}>Browse and organize your saved notes.</Text>
            </View>
          )}
          <View style={styles.headingActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search notes"
              hitSlop={6}
              onPress={() => router.push("/notes/search")}
              style={({ pressed }) => [
                styles.searchButton,
                { backgroundColor: colors.accentSoft, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.searchLens, { borderColor: colors.accent }]}>
                <View style={[styles.searchHandle, { backgroundColor: colors.accent }]} />
              </View>
            </Pressable>
            <View style={styles.headingAction}>
              <AppButton
                label="+ New workspace"
                onPress={() => setIsModalVisible(true)}
              />
            </View>
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

      <SafeAreaModal
        androidPresentation="center"
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>New workspace</Text>
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              Keyboard.dismiss();
              setIsModalVisible(false);
            }}
          >
            <Text style={[styles.close, { color: colors.textMuted }]}>Close</Text>
          </Pressable>
        </View>
        <Text style={[styles.label, { color: colors.textMuted }]}>Name</Text>
        <TextInput
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
          <Text style={[styles.formError, { color: colors.danger }]}>{formError}</Text>
        )}
        <AppButton
          label={isSaving ? "Creating..." : "Create workspace"}
          disabled={isSaving}
          onPress={() => void createWorkspace()}
        />
      </SafeAreaModal>
    </View>
  );
}

export default function WorkspacesScreen() {
  return <WorkspaceListScreen />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.xl, padding: Spacing.lg },
  headingSection: { gap: Spacing.lg },
  heading: { gap: Spacing.xs },
  headingActions: { flexDirection: "row", gap: Spacing.sm, justifyContent: "flex-end", width: "100%" },
  headingAction: { flex: 1, minWidth: 0 },
  searchButton: { alignItems: "center", borderCurve: "continuous", borderRadius: Radius.sm, borderWidth: 1, height: 46, justifyContent: "center", width: 46 },
  searchLens: { borderRadius: 8, borderWidth: 2.2, height: 16, position: "relative", width: 16 },
  searchHandle: { borderRadius: 2, bottom: -6, height: 8, position: "absolute", right: -4, transform: [{ rotate: "-45deg" }], width: 2.2 },
  pressed: { opacity: 0.72 },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 34, fontWeight: "800" },
  workspaceSubtitle: { fontSize: 14, lineHeight: 20 },
  list: { gap: Spacing.md },
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
