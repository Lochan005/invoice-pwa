import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInvoice } from '../../context/InvoiceContext';
import FormSection from '../../components/FormSection';
import FormInput from '../../components/FormInput';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function CreateScreen() {
  const router = useRouter();
  const {
    invoice,
    updateCompany,
    updateClient,
    updateBank,
    updateField,
    addLineItem,
    removeLineItem,
    updateLineItem,
    totals,
    setInvoice,
  } = useInvoice();
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!invoice.invoice_number) {
      Alert.alert('Required', 'Please enter an invoice number');
      return;
    }
    setSaving(true);
    try {
      const body = {
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        company_details: invoice.company_details,
        client_details: invoice.client_details,
        bank_details: invoice.bank_details,
        line_items: invoice.line_items,
        notes: invoice.notes,
      };
      const method = invoice.id ? 'PUT' : 'POST';
      const url = invoice.id
        ? `${API_URL}/api/invoices/${invoice.id}`
        : `${API_URL}/api/invoices`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save');
      const saved = await res.json();
      setInvoice(saved);
      Alert.alert('Success', 'Invoice saved!', [
        { text: 'View Preview', onPress: () => router.push('/(tabs)/preview') },
        { text: 'OK' },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }, [invoice]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Create Invoice</Text>
            <Text style={styles.headerSub}>Fill in the details below</Text>
          </View>

          {/* Your Company */}
          <FormSection title="Your Company Details">
            <FormInput label="Company Name" value={invoice.company_details.company_name} onChangeText={v => updateCompany('company_name', v)} testID="input-company-name" />
            <FormInput label="Company Email" value={invoice.company_details.company_email} onChangeText={v => updateCompany('company_email', v)} keyboardType="email-address" testID="input-company-email" />
            <FormInput label="Contact Name" value={invoice.company_details.contact_name} onChangeText={v => updateCompany('contact_name', v)} testID="input-contact-name" />
            <FormInput label="Phone" value={invoice.company_details.phone} onChangeText={v => updateCompany('phone', v)} keyboardType="phone-pad" testID="input-phone" />
            <FormInput label="ABN" value={invoice.company_details.abn} onChangeText={v => updateCompany('abn', v)} testID="input-abn" />
            <FormInput label="Address Line 1" value={invoice.company_details.address_line1} onChangeText={v => updateCompany('address_line1', v)} testID="input-address1" />
            <FormInput label="Address Line 2" value={invoice.company_details.address_line2} onChangeText={v => updateCompany('address_line2', v)} testID="input-address2" />
            <FormInput label="Address Line 3" value={invoice.company_details.address_line3} onChangeText={v => updateCompany('address_line3', v)} testID="input-address3" />
          </FormSection>

          {/* Invoice To */}
          <FormSection title="Invoice To">
            <FormInput label="Company Name" value={invoice.client_details.company_name} onChangeText={v => updateClient('company_name', v)} testID="input-client-company" />
            <FormInput label="Contact Name" value={invoice.client_details.contact_name} onChangeText={v => updateClient('contact_name', v)} testID="input-client-contact" />
            <FormInput label="Email" value={invoice.client_details.company_email} onChangeText={v => updateClient('company_email', v)} keyboardType="email-address" testID="input-client-email" />
            <FormInput label="Address Line 1" value={invoice.client_details.address_line1} onChangeText={v => updateClient('address_line1', v)} testID="input-client-address1" />
            <FormInput label="Address Line 2" value={invoice.client_details.address_line2} onChangeText={v => updateClient('address_line2', v)} testID="input-client-address2" />
            <FormInput label="Address Line 3" value={invoice.client_details.address_line3} onChangeText={v => updateClient('address_line3', v)} testID="input-client-address3" />
          </FormSection>

          {/* Invoice Details */}
          <FormSection title="Invoice Details">
            <FormInput label="Invoice Number" value={invoice.invoice_number} onChangeText={v => updateField('invoice_number', v)} placeholder="e.g. 001" testID="input-invoice-number" />
            <FormInput label="Invoice Date" value={invoice.invoice_date} onChangeText={v => updateField('invoice_date', v)} placeholder="YYYY-MM-DD" testID="input-invoice-date" />
            <FormInput label="Due Date" value={invoice.due_date} onChangeText={v => updateField('due_date', v)} placeholder="YYYY-MM-DD" testID="input-due-date" />
          </FormSection>

          {/* Bank Details */}
          <FormSection title="Bank Details">
            <FormInput label="Account Name" value={invoice.bank_details.account_name} onChangeText={v => updateBank('account_name', v)} testID="input-bank-name" />
            <FormInput label="BSB" value={invoice.bank_details.bsb} onChangeText={v => updateBank('bsb', v)} testID="input-bank-bsb" />
            <FormInput label="Account Number" value={invoice.bank_details.account_number} onChangeText={v => updateBank('account_number', v)} testID="input-bank-account" />
          </FormSection>

          {/* Line Items */}
          <FormSection title="Line Items">
            {invoice.line_items.map((item, idx) => (
              <View key={item.id} style={styles.lineItem} testID={`line-item-${idx}`}>
                <View style={styles.lineItemHeader}>
                  <Text style={styles.lineItemTitle}>Item #{idx + 1}</Text>
                  {invoice.line_items.length > 1 && (
                    <TouchableOpacity
                      testID={`remove-item-${idx}`}
                      onPress={() => removeLineItem(item.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                <FormInput label="Service Date" value={item.service_date} onChangeText={v => updateLineItem(item.id, 'service_date', v)} placeholder="YYYY-MM-DD" testID={`input-service-date-${idx}`} />
                <FormInput label="Product / Service" value={item.product} onChangeText={v => updateLineItem(item.id, 'product', v)} testID={`input-product-${idx}`} />
                <FormInput label="Description" value={item.description} onChangeText={v => updateLineItem(item.id, 'description', v)} testID={`input-description-${idx}`} />
                <View style={styles.gstRow}>
                  <Text style={styles.gstLabel}>GST (10%)</Text>
                  <Switch
                    testID={`gst-switch-${idx}`}
                    value={item.gst_applicable}
                    onValueChange={v => updateLineItem(item.id, 'gst_applicable', v)}
                    trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                    thumbColor={item.gst_applicable ? '#2563EB' : '#9CA3AF'}
                  />
                </View>
                <View style={styles.qtyRateRow}>
                  <View style={styles.qtyRateField}>
                    <FormInput label="Qty" value={String(item.quantity)} onChangeText={v => updateLineItem(item.id, 'quantity', parseFloat(v) || 0)} keyboardType="numeric" testID={`input-qty-${idx}`} />
                  </View>
                  <View style={styles.qtyRateField}>
                    <FormInput label="Rate" value={String(item.rate)} onChangeText={v => updateLineItem(item.id, 'rate', parseFloat(v) || 0)} keyboardType="numeric" testID={`input-rate-${idx}`} />
                  </View>
                  <View style={styles.amountBox}>
                    <Text style={styles.amountLabel}>Amount</Text>
                    <Text style={styles.amountValue} testID={`amount-${idx}`}>
                      ${(item.quantity * item.rate).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addBtn} onPress={addLineItem} testID="add-item-btn">
              <Ionicons name="add-circle-outline" size={20} color="#2563EB" />
              <Text style={styles.addBtnText}>Add Item</Text>
            </TouchableOpacity>
          </FormSection>

          {/* Totals */}
          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue} testID="subtotal">${totals.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST (10%)</Text>
              <Text style={styles.totalValue} testID="gst-total">${totals.gst_total.toFixed(2)}</Text>
            </View>
            <View style={[styles.totalRow, styles.balanceRow]}>
              <Text style={styles.balanceLabel}>Balance Due</Text>
              <Text style={styles.balanceValue} testID="balance-due">A${totals.total.toFixed(2)}</Text>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
            testID="save-invoice-btn"
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFF" />
                <Text style={styles.saveBtnText}>Save Invoice</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  lineItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lineItemTitle: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
  gstRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  gstLabel: { fontSize: 13, fontWeight: '500', color: '#374151' },
  qtyRateRow: { flexDirection: 'row', gap: 8 },
  qtyRateField: { flex: 1 },
  amountBox: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 14 },
  amountLabel: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4 },
  amountValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 8,
    borderStyle: 'dashed',
    gap: 6,
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: '#2563EB' },
  totalsCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  totalLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  totalValue: { fontSize: 14, color: '#111827', fontWeight: '600' },
  balanceRow: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: '#2563EB',
    marginTop: 4,
    paddingTop: 12,
  },
  balanceLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  balanceValue: { fontSize: 18, fontWeight: '800', color: '#2563EB' },
  saveBtn: {
    backgroundColor: '#2563EB',
    height: 52,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
