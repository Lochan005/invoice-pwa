import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInvoice } from '../../context/InvoiceContext';
import { Invoice } from '../../types/invoice';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function SavedScreen() {
  const router = useRouter();
  const { loadInvoice, resetInvoice } = useInvoice();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/invoices`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setInvoices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchInvoices();
    }, [fetchInvoices])
  );

  const handleLoad = (inv: Invoice) => {
    loadInvoice(inv);
    router.push('/(tabs)/preview');
  };

  const handleDelete = (inv: Invoice) => {
    Alert.alert(
      'Delete Invoice',
      `Are you sure you want to delete Invoice #${inv.invoice_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_URL}/api/invoices/${inv.id}`, { method: 'DELETE' });
              setInvoices(prev => prev.filter(i => i.id !== inv.id));
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const handleNewInvoice = () => {
    resetInvoice();
    router.push('/(tabs)/create');
  };

  const renderItem = ({ item, index }: { item: Invoice; index: number }) => (
    <View style={styles.card} testID={`saved-invoice-${index}`}>
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => handleLoad(item)}
        activeOpacity={0.7}
      >
        <View style={styles.invoiceIcon}>
          <Text style={styles.invoiceIconText}>#{item.invoice_number || '?'}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            Invoice #{item.invoice_number}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {item.client_details?.company_name || 'No client'} · A${item.total?.toFixed(2) || '0.00'}
          </Text>
          <Text style={styles.cardDate}>
            {item.invoice_date || 'No date'}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => handleDelete(item)}
        testID={`delete-invoice-${index}`}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={16} color="#FFF" />
        <Text style={styles.deleteBtnText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Saved Invoices</Text>
          <Text style={styles.headerCount}>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={handleNewInvoice} testID="new-invoice-btn">
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.newBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : invoices.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="document-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Invoices Yet</Text>
          <Text style={styles.emptyText}>Create your first invoice to get started</Text>
          <TouchableOpacity style={styles.createBtn} onPress={handleNewInvoice} testID="create-first-invoice-btn">
            <Text style={styles.createBtnText}>Create Invoice</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={item => item.id || Math.random().toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchInvoices(); }}
              tintColor="#2563EB"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  headerCount: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  createBtn: {
    marginTop: 20,
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  list: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  invoiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  invoiceIconText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  cardDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 8,
  },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
});
