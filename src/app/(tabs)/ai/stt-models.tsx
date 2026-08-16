import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { appContainer } from "@/application";
import { SttModelCard, SttModelCardStatus } from "@/components/stt-model-card";
import { Colors, Spacing } from "@/constants/theme";
import { SttModel } from "@/domain/stt-model/stt-model";
import { useTheme } from "@/hooks/use-theme";
import { SttModelDownloadProgress } from "@/services/stt-model-service";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; installedById: Map<string, SttModel> };

type RowState = {
  isBusy: boolean;
  progress: SttModelDownloadProgress | null;
  error: string | null;
};

const emptyRowState: RowState = { isBusy: false, progress: null, error: null };

export default function SttModelsScreen() {
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const { sttModelService } = appContainer;
  const catalog = sttModelService.getCatalog();
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  const setRowState = (id: string, patch: Partial<RowState>) => {
    setRowStates((previous) => ({
      ...previous,
      [id]: { ...emptyRowState, ...previous[id], ...patch },
    }));
  };

  const loadInstalledModels = async () => {
    try {
      const installed = await sttModelService.getInstalledModels();
      setState({
        status: "success",
        installedById: new Map(
          installed.map((model) => [model.getId(), model]),
        ),
      });
    } catch {
      setState({ status: "error", message: "Unable to load STT models." });
    }
  };

  useEffect(() => {
    void loadInstalledModels();
  }, []);

  const handleDownload = async (catalogId: string) => {
    setRowState(catalogId, { isBusy: true, error: null, progress: null });

    try {
      await sttModelService.downloadModel(catalogId, (progress) =>
        setRowState(catalogId, { progress }),
      );
      setRowState(catalogId, { isBusy: false, progress: null });
      await loadInstalledModels();
    } catch (error) {
      setRowState(catalogId, {
        isBusy: false,
        progress: null,
        error: error instanceof Error ? error.message : "Download failed.",
      });
    }
  };

  const handleUse = async (catalogId: string) => {
    setRowState(catalogId, { isBusy: true, error: null });

    try {
      await sttModelService.setActiveModel(catalogId);
      setRowState(catalogId, { isBusy: false });
      await loadInstalledModels();
    } catch (error) {
      setRowState(catalogId, {
        isBusy: false,
        error:
          error instanceof Error ? error.message : "Unable to use this model.",
      });
    }
  };

  const uninstall = async (catalogId: string) => {
    setRowState(catalogId, { isBusy: true, error: null });

    try {
      await sttModelService.uninstallModel(catalogId);
      setRowState(catalogId, { isBusy: false });
      await loadInstalledModels();
    } catch (error) {
      setRowState(catalogId, {
        isBusy: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to remove this model.",
      });
    }
  };

  const handleUninstall = (catalogId: string, name: string) => {
    Alert.alert("Uninstall model", `Remove "${name}" from this device?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Uninstall",
        style: "destructive",
        onPress: () => void uninstall(catalogId),
      },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "STT Models", headerLargeTitle: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={[styles.kicker, { color: colors.accent }]}>
            SPEECH TO TEXT
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>STT Models</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Download models to run speech recognition fully on this device.
          </Text>
        </View>

        {state.status === "error" && (
          <Text style={[styles.error, { color: colors.danger }]}>
            {state.message}
          </Text>
        )}

        <View style={styles.list}>
          {catalog.map((entry) => {
            const installed =
              state.status === "success"
                ? (state.installedById.get(entry.id) ?? null)
                : null;
            const rowState = rowStates[entry.id] ?? emptyRowState;
            const status: SttModelCardStatus = rowState.progress
              ? "downloading"
              : installed
                ? installed.getIsActive()
                  ? "active"
                  : "installed"
                : "not-installed";

            return (
              <SttModelCard
                key={entry.id}
                name={entry.name}
                description={entry.description}
                format={entry.format}
                quantization={entry.quantization}
                sizeBytes={installed?.getSizeBytes() ?? entry.sizeBytes}
                status={status}
                progress={rowState.progress}
                isBusy={rowState.isBusy}
                errorMessage={rowState.error}
                onDownload={() => void handleDownload(entry.id)}
                onUse={() => void handleUse(entry.id)}
                onUninstall={() => handleUninstall(entry.id, entry.name)}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  heading: { gap: Spacing.xs },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 34, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 22 },
  error: { fontSize: 14 },
  list: { gap: Spacing.md },
});
