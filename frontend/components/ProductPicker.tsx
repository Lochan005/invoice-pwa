import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PRODUCTS = [
  'Bush reboring and taping',
  'Bush turning',
  'CNC milling',
  'CNC turning',
  'CNC turning and milling',
  'Drilling',
  'Delivery',
  'Laser cut',
  'Freight',
  'Lathe services',
  'Other materials',
];

interface Props {
  label: string;
  value: string;
  onSelect: (value: string) => void;
  testID?: string;
}

export default function ProductPicker({ label, value, onSelect, testID }: Props) {
  const [visible, setVisible] = useState(false);

  const handleSelect = (item: string) => {
    onSelect(item);
    setVisible(false);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setVisible(true)}
        testID={testID}
        activeOpacity={0.7}
      >
        <Text style={value ? styles.valueText : styles.placeholder} numberOfLines={1}>
          {value || 'Select product / service'}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.dropdown} testID="product-dropdown">
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Select Product / Service</Text>
              <TouchableOpacity onPress={() => setVisible(false)} testID="close-product-dropdown">
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={PRODUCTS}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, value === item && styles.optionSelected]}
                  onPress={() => handleSelect(item)}
                  testID={`product-option-${item.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <Text style={[styles.optionText, value === item && styles.optionTextSelected]}>
                    {item}
                  </Text>
                  {value === item && <Ionicons name="checkmark" size={18} color="#2563EB" />}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4 },
  selector: {
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueText: { fontSize: 15, color: '#111827', flex: 1 },
  placeholder: { fontSize: 15, color: '#9CA3AF', flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dropdown: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {} : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 8,
    }),
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dropdownTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionSelected: { backgroundColor: '#EFF6FF' },
  optionText: { fontSize: 15, color: '#374151' },
  optionTextSelected: { color: '#2563EB', fontWeight: '600' },
  separator: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },
});
