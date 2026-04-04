import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  label: string;
  value: string;
  onChangeDate: (dateStr: string) => void;
  testID?: string;
}

const toHTMLDate = (ddmmyyyy: string): string => {
  if (!ddmmyyyy) return '';
  const p = ddmmyyyy.split('/');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
};

const fromHTMLDate = (htmlDate: string): string => {
  if (!htmlDate) return '';
  const p = htmlDate.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '';
};

export default function DateInput({ label, value, onChangeDate, testID }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      {/* @ts-ignore - HTML input for web date picker */}
      <input
        type="date"
        value={toHTMLDate(value)}
        onChange={(e: any) => {
          const val = e.target.value;
          if (val) onChangeDate(fromHTMLDate(val));
        }}
        data-testid={testID}
        style={{
          height: 44,
          border: '1px solid #D1D5DB',
          borderRadius: 8,
          paddingLeft: 12,
          paddingRight: 12,
          fontSize: 15,
          color: '#111827',
          backgroundColor: '#FFFFFF',
          outline: 'none',
          fontFamily: 'inherit',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4 },
});
