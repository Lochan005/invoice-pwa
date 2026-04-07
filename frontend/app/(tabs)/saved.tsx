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
import { apiUrl, parseApiError } from '../../lib/api';

export default function SavedScreen() {
  const router = useRouter();
  const { loadInvoice, resetInvoice } = useInvoice();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setListError(null);
    try {
      const res = await fetch(apiUrl('/api/invoices'));
      if (!res.ok) {
        const msg = await parseApiError(res);
        throw new Error(msg);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Invalid response: expected a list of invoices');
      }
      setInvoices(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not load invoices';
      setListError(message);
      console.error('[Saved]', message);
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
              const res = await fetch(apiUrl(`/api/invoices/${inv.id}`), { method: 'DELETE' });
              if (!res.ok) {
                throw new Error(await parseApiError(res));
              }
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

      {listError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="cloud-offline-outline" size={22} color="#B45309" />
          <View style={styles.errorBannerText}>
            <Text style={styles.errorTitle}>Couldn&apos;t load invoices</Text>
            <Text style={styles.errorDetail}>{listError}</Text>
          </View>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchInvoices(); }}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : invoices.length > 0 ? (
        <FlatList
          data={invoices}
          keyExtractor={(item, index) => item.id || `invoice-${index}`}
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
      ) : !listError ? (
        <View style={styles.center}>
          <Ionicons name="document-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Invoices Yet</Text>
          <Text style={styles.emptyText}>Create your first invoice to get started</Text>
          <TouchableOpacity style={styles.createBtn} onPress={handleNewInvoice} testID="create-first-invoice-btn">
            <Text style={styles.createBtnText}>Create Invoice</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.errorPlaceholder} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  errorBannerText: { flex: 1 },
  errorTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  errorDetail: { fontSize: 12, color: '#B45309', marginTop: 4 },
  retryBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  errorPlaceholder: { flex: 1 },
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
