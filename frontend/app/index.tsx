import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(tabs)/create');
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container} testID="splash-screen">
      <StatusBar style="light" />
      <View style={styles.content}>
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>INV</Text>
        </View>
        <Text style={styles.title}>Invoice Generator</Text>
        <Text style={styles.subtitle}>Professional Invoice Management</Text>
      </View>
      <Text style={styles.footer}>Create · Preview · Send</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.75)',
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
});
