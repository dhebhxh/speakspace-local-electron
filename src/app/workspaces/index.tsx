import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { appContainer } from "@/application";
import { AppButton } from "@/components/app-button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { WorkspaceCard } from "@/components/workspace-card";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { ValidationError } from "@/errors/validation-error";
import { useTheme } from "@/hooks/use-theme";

export default function WorkspacesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const { workspaceService } = appContainer;
  const [workspaces, setWorkspaces] = useState<
    Awaited<ReturnType<typeof workspaceService.getWorkspaces>>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadWorkspaces = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setWorkspaces(await workspaceService.getWorkspaces());
    } catch {
      setError("Unable to load workspaces.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspaces();
  }, []);

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
      <Stack.Screen options={{ title: "Workspaces", headerLargeTitle: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headingRow}>
          <View style={styles.heading}>
            <Text style={[styles.kicker, { color: colors.accent }]}>
              YOUR LIBRARY
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              Workspaces
            </Text>
          </View>
          <AppButton label="New" onPress={() => setIsModalVisible(true)} />
        </View>

        {isLoading && <LoadingState />}
        {!isLoading && error && (
          <ErrorState message={error} onRetry={() => void loadWorkspaces()} />
        )}
        {!isLoading && !error && workspaces.length === 0 && (
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
        {!isLoading && !error && workspaces.length > 0 && (
          <View style={styles.list}>
            {workspaces.map((workspace) => (
              <WorkspaceCard
                key={workspace.getId()}
                workspace={workspace}
                onPress={() =>
                  router.push({
                    pathname: "/workspaces/[workspaceId]/index",
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
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                New workspace
              </Text>
              <Pressable
                onPress={() => setIsModalVisible(false)}
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
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  headingRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heading: { gap: Spacing.xs },
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
    paddingBottom: Spacing.xxl,
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
