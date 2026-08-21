import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";

import { FloatingAskAiButton } from "@/components/floating-ask-ai-button";
import { Colors } from "@/constants/theme";
import { databaseConfig, initializeDatabase } from "@/database";
import { useTheme } from "@/hooks/use-theme";

export default function RootLayout() {
  const theme = useTheme();
  const colors = Colors[theme.mode];

  return (
    <SQLiteProvider
      databaseName={databaseConfig.databaseName}
      onInit={initializeDatabase}
    >
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
    </SQLiteProvider>
  );
}
