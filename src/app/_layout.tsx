import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";

import { databaseConfig, initializeDatabase } from "@/database";

export default function RootLayout() {
  return (
    <SQLiteProvider
      databaseName={databaseConfig.databaseName}
      onInit={initializeDatabase}
    >
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SQLiteProvider>
  );
}
