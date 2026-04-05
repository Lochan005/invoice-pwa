import { Stack } from 'expo-router';
import { InvoiceProvider } from '../context/InvoiceContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <InvoiceProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </InvoiceProvider>
  );
}
