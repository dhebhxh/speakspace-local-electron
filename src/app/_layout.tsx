import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState } from "react-native";

import { FloatingAskAiButton } from "@/components/floating-ask-ai-button";
import { appContainer } from "@/application";
import { Colors } from "@/constants/theme";
import { databaseConfig, initializeDatabase } from "@/database";
import { useTheme } from "@/hooks/use-theme";
import { ThemeProvider } from "@/providers/theme-provider";
import { TrashUndoProvider } from "@/providers/trash-undo-provider";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedRootLayout />
    </ThemeProvider>
  );
}

function ThemedRootLayout() {
  const theme = useTheme();
  const colors = Colors[theme.mode];

  useEffect(() => {
    appContainer.speechPlaybackService.initialize();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        appContainer.speechPlaybackService.pauseForBackground();
        void appContainer.llmInferenceService.stopGenerationForBackground();
      }
    });
    void SplashScreen.hideAsync();
    return () => subscription.remove();
  }, []);

  return (
    <SQLiteProvider
      databaseName={databaseConfig.databaseName}
      onInit={initializeDatabase}
    >
      <TrashUndoProvider>
        <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
        <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerBackTitle: "Back",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.text },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ask-ai" options={{ title: "Ask AI" }} />
        <Stack.Screen name="transcription" options={{ title: "Transcription" }} />
        <Stack.Screen name="audio-transcription" options={{ title: "Transcribe audio file" }} />
        </Stack>
        <FloatingAskAiButton />
      </TrashUndoProvider>
    </SQLiteProvider>
  );
}
