import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface Props {
  label: string;
  value: string;
  onChangeDate: (dateStr: string) => void;
  testID?: string;
}

const parseDDMMYYYY = (str: string): Date => {
  if (!str) return new Date();
  const parts = str.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date();
};

const formatDDMMYYYY = (date: Date): string => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

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
  const [showPicker, setShowPicker] = useState(false);

  const handleNativeChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPicker(false);
    if (selectedDate) {
      onChangeDate(formatDDMMYYYY(selectedDate));
    }
  };

  if (Platform.OS === 'web') {
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

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.dateBtn}
        onPress={() => setShowPicker(true)}
        testID={testID}
        activeOpacity={0.7}
      >
        <Text style={value ? styles.dateText : styles.datePlaceholder}>
          {value || 'Select date'}
        </Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={parseDDMMYYYY(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleNativeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4 },
  dateBtn: {
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dateText: { fontSize: 15, color: '#111827' },
  datePlaceholder: { fontSize: 15, color: '#9CA3AF' },
});
