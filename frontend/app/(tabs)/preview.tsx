import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInvoice } from '../../context/InvoiceContext';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function PreviewScreen() {
  const { invoice, totals } = useInvoice();
  const [downloading, setDownloading] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailModal, setEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');

  const company = invoice.company_details;
  const client = invoice.client_details;
  const bank = invoice.bank_details;

  const handleDownloadPdf = async () => {
    if (!invoice.id) {
      Alert.alert('Save First', 'Please save the invoice before downloading PDF.');
      return;
    }
    setDownloading(true);
    try {
      const res = await fetch(`${API_URL}/api/invoices/${invoice.id}/pdf`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const data = await res.json();

      if (Platform.OS === 'web') {
        const byteChars = atob(data.pdf_base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const fileUri = FileSystem.documentDirectory + data.filename;
        await FileSystem.writeAsStringAsync(fileUri, data.pdf_base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
      }
      Alert.alert('Success', 'PDF downloaded!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo) {
      Alert.alert('Required', 'Please enter recipient email');
      return;
    }
    if (!invoice.id) {
      Alert.alert('Save First', 'Please save the invoice before emailing.');
      return;
    }
    setEmailing(true);
    try {
      const res = await fetch(`${API_URL}/api/invoices/${invoice.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_email: emailTo,
          subject: emailSubject || `Invoice #${invoice.invoice_number}`,
          message: emailMessage,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to send email');
      }
      Alert.alert('Success', `Invoice emailed to ${emailTo}`);
      setEmailModal(false);
      setEmailTo('');
      setEmailSubject('');
      setEmailMessage('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setEmailing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Invoice Preview</Text>
        {invoice.id && (
          <View style={styles.savedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={styles.savedText}>Saved</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Paper */}
        <View style={styles.paper} testID="invoice-preview">
          {/* Company Header */}
          <View style={styles.paperHeader}>
            {company.company_name ? (
              <Text style={styles.companyName}>{company.company_name}</Text>
            ) : (
              <Text style={styles.placeholder}>Your Company Name</Text>
            )}
            <Text style={styles.taxInvoiceTitle}>Tax Invoice</Text>
          </View>

          {/* Company Info */}
          <View style={styles.companyInfo}>
            {[company.address_line1, company.address_line2, company.address_line3].filter(Boolean).map((l, i) => (
              <Text key={i} style={styles.infoText}>{l}</Text>
            ))}
            {company.phone ? <Text style={styles.infoText}>{company.phone}</Text> : null}
            {company.company_email ? <Text style={styles.infoText}>{company.company_email}</Text> : null}
            {company.abn ? <Text style={styles.infoText}>ABN {company.abn}</Text> : null}
          </View>

          {/* Client + Invoice Details */}
          <View style={styles.twoCol}>
            <View style={styles.colLeft}>
              <Text style={styles.sectionLabel}>Invoice To</Text>
              <Text style={styles.clientName}>{client.company_name || '—'}</Text>
              {client.contact_name ? <Text style={styles.infoText}>{client.contact_name}</Text> : null}
              {client.address_line1 ? <Text style={styles.infoText}>{client.address_line1}</Text> : null}
              {client.company_email ? <Text style={styles.infoText}>{client.company_email}</Text> : null}
            </View>
            <View style={styles.colRight}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>INVOICE</Text>
                <Text style={styles.detailValue}>{invoice.invoice_number || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>DATE</Text>
                <Text style={styles.detailValue}>{invoice.invoice_date || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>DUE DATE</Text>
                <Text style={styles.detailValue}>{invoice.due_date || '—'}</Text>
              </View>
            </View>
          </View>

          {/* Line Items Table */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2 }]}>Product</Text>
              <Text style={[styles.th, { flex: 2 }]}>Description</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>GST</Text>
              <Text style={[styles.th, { flex: 0.8, textAlign: 'center' }]}>Qty</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Rate</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Amount</Text>
            </View>
            {invoice.line_items.map((item, idx) => (
              <View key={item.id} style={styles.tableRow} testID={`preview-item-${idx}`}>
                <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{item.product || '—'}</Text>
                <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{item.description || '—'}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'center' }]}>{item.gst_applicable ? 'Yes' : 'No'}</Text>
                <Text style={[styles.td, { flex: 0.8, textAlign: 'center' }]}>{item.quantity}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>${item.rate.toFixed(2)}</Text>
                <Text style={[styles.td, { flex: 1.2, textAlign: 'right' }]}>${(item.quantity * item.rate).toFixed(2)}</Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totals}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>SUBTOTAL</Text>
              <Text style={styles.totalsValue} testID="preview-subtotal">${totals.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>GST TOTAL</Text>
              <Text style={styles.totalsValue} testID="preview-gst">${totals.gst_total.toFixed(2)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>TOTAL</Text>
              <Text style={styles.totalsValue} testID="preview-total">${totals.total.toFixed(2)}</Text>
            </View>
            <View style={[styles.totalsRow, styles.balanceDueRow]}>
              <Text style={styles.balanceDueLabel}>BALANCE DUE</Text>
              <Text style={styles.balanceDueValue} testID="preview-balance">A${totals.total.toFixed(2)}</Text>
            </View>
          </View>

          {/* Bank Details */}
          {(bank.account_name || bank.bsb || bank.account_number) && (
            <View style={styles.bankSection}>
              <View style={styles.bankDivider} />
              <Text style={styles.bankTitle}>BANK DETAILS</Text>
              {bank.account_name ? <Text style={styles.bankText}>ACCOUNT NAME: {bank.account_name}</Text> : null}
              {bank.bsb ? <Text style={styles.bankText}>BSB NO: {bank.bsb}</Text> : null}
              {bank.account_number ? <Text style={styles.bankText}>ACCOUNT NO: {bank.account_number}</Text> : null}
            </View>
          )}

          {/* Footer */}
          <Text style={styles.thankYou}>THANK YOU FOR YOUR BUSINESS</Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleDownloadPdf}
          disabled={downloading}
          testID="download-pdf-btn"
        >
          {downloading ? (
            <ActivityIndicator color="#2563EB" size="small" />
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color="#2563EB" />
              <Text style={styles.actionBtnText}>Download PDF</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.emailBtn]}
          onPress={() => setEmailModal(true)}
          testID="email-invoice-btn"
        >
          <Ionicons name="mail-outline" size={20} color="#FFF" />
          <Text style={styles.emailBtnText}>Email Invoice</Text>
        </TouchableOpacity>
      </View>

      {/* Email Modal */}
      <Modal visible={emailModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent} testID="email-modal">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Email Invoice</Text>
              <TouchableOpacity onPress={() => setEmailModal(false)} testID="close-email-modal">
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>Recipient Email *</Text>
            <TextInput
              testID="email-recipient-input"
              style={styles.modalInput}
              value={emailTo}
              onChangeText={setEmailTo}
              placeholder="email@example.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.modalLabel}>Subject</Text>
            <TextInput
              testID="email-subject-input"
              style={styles.modalInput}
              value={emailSubject}
              onChangeText={setEmailSubject}
              placeholder={`Invoice #${invoice.invoice_number}`}
              placeholderTextColor="#9CA3AF"
            />
            <Text style={styles.modalLabel}>Message</Text>
            <TextInput
              testID="email-message-input"
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              value={emailMessage}
              onChangeText={setEmailMessage}
              placeholder="Optional message..."
              placeholderTextColor="#9CA3AF"
              multiline
            />
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={handleSendEmail}
              disabled={emailing}
              testID="send-email-btn"
            >
              {emailing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.sendBtnText}>Send Email</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  savedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  savedText: { fontSize: 12, color: '#10B981', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  paper: {
    backgroundColor: '#FFF',
    borderRadius: 4,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paperHeader: { marginBottom: 12 },
  companyName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  placeholder: { fontSize: 16, fontWeight: '700', color: '#D1D5DB', fontStyle: 'italic' },
  taxInvoiceTitle: { fontSize: 22, fontWeight: '800', color: '#2563EB', marginTop: 4 },
  companyInfo: { marginBottom: 16 },
  infoText: { fontSize: 11, color: '#6B7280', lineHeight: 16 },
  twoCol: { flexDirection: 'row', marginBottom: 16 },
  colLeft: { flex: 1 },
  colRight: { flex: 1, alignItems: 'flex-end' },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  clientName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  detailRow: { flexDirection: 'row', gap: 8, marginBottom: 2 },
  detailLabel: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  detailValue: { fontSize: 10, color: '#111827', fontWeight: '500' },
  table: { marginBottom: 12 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  th: { fontSize: 9, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  td: { fontSize: 10, color: '#374151' },
  totals: { alignItems: 'flex-end', marginBottom: 16 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '60%', paddingVertical: 3 },
  totalsLabel: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  totalsValue: { fontSize: 10, color: '#111827', fontWeight: '500' },
  balanceDueRow: { borderTopWidth: 1.5, borderTopColor: '#2563EB', marginTop: 4, paddingTop: 6 },
  balanceDueLabel: { fontSize: 12, fontWeight: '800', color: '#111827' },
  balanceDueValue: { fontSize: 12, fontWeight: '800', color: '#2563EB' },
  bankSection: { marginBottom: 16 },
  bankDivider: { height: 0.5, backgroundColor: '#E5E7EB', marginBottom: 8 },
  bankTitle: { fontSize: 10, fontWeight: '700', color: '#111827', marginBottom: 4 },
  bankText: { fontSize: 10, color: '#6B7280', lineHeight: 16 },
  thankYou: { fontSize: 10, fontWeight: '700', color: '#6B7280', textAlign: 'center', marginTop: 8 },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    backgroundColor: '#FFF',
  },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: '#2563EB' },
  emailBtn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  emailBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  modalLabel: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4, marginTop: 12 },
  modalInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  sendBtn: {
    backgroundColor: '#2563EB',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  sendBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
