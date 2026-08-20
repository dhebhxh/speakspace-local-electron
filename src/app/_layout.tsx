import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";

import { FloatingAskAiButton } from "@/components/floating-ask-ai-button";
import { databaseConfig, initializeDatabase } from "@/database";

export default function RootLayout() {
  return (
    <SQLiteProvider
      databaseName={databaseConfig.databaseName}
      onInit={initializeDatabase}
    >
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ask-ai" options={{ title: "Ask AI" }} />
        <Stack.Screen name="transcription" options={{ title: "Transcription" }} />
        <Stack.Screen name="audio-transcription" options={{ title: "Transcribe audio file" }} />
      </Stack>
      <FloatingAskAiButton />
    </SQLiteProvider>
  );
}
