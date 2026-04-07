import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInvoice } from '../../context/InvoiceContext';
import * as Sharing from 'expo-sharing';
import { apiUrl, mapFetchFailureMessage, parseApiError } from '../../lib/api';

// Hardcoded company & bank details matching the PDF
const COMPANY = {
  name: 'The trustee for SAITECH TRADING TRUST',
  address: ['33 LOWANNAWAY', 'ARMADALE WA  6112'],
  phone: '+61 470530451',
  email: 'shiva.prasad1947@gmail.com',
  abn: 'ABN 39315636679',
};
const BANK = {
  title: 'BANK DETAILS;',
  account_name: 'SAITECH ENGINEERING PTY LTD',
  bsb: '086006',
  account_no: '925720296',
};

// Helper for mobile PDF save using new expo-file-system API
const savePdfMobile = async (base64Data: string, filename: string) => {
  try {
    // Use the new File API (expo-file-system v19+)
    const { File, Paths } = require('expo-file-system/next');
    const file = new File(Paths.cache, filename);
    file.write(base64Data, { encoding: 'base64' });
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf' });
  } catch {
    // Fallback to legacy API
    const FileSystem = require('expo-file-system/legacy');
    const fileUri = FileSystem.documentDirectory + filename;
    await FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: 'base64' });
    await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
  }
};

export default function PreviewScreen() {
  const { invoice, totals } = useInvoice();
  const [downloading, setDownloading] = useState(false);
  const [emailing, setEmailing] = useState(false);

  const client = invoice.client_details;

  const handleDownloadPdf = async () => {
    if (!invoice.id) {
      Alert.alert('Save First', 'Please save the invoice before downloading PDF.');
      return;
    }
    setDownloading(true);
    try {
      const res = await fetch(apiUrl(`/api/invoices/${invoice.id}/pdf`), { method: 'POST' });
      if (!res.ok) throw new Error(await parseApiError(res));
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
        await savePdfMobile(data.pdf_base64, data.filename);
      }
      Alert.alert('Success', 'PDF downloaded!');
    } catch (e: any) {
      Alert.alert('Error', mapFetchFailureMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  const handleEmailInvoice = async () => {
    if (!invoice.id) {
      Alert.alert('Save First', 'Please save the invoice before emailing.');
      return;
    }
    
    const clientEmail = invoice.client_details?.company_email;
    if (!clientEmail) {
      Alert.alert('No Email', 'Please add a company email in the "Invoice To" section first.');
      return;
    }
    
    setEmailing(true);
    try {
      const res = await fetch(apiUrl(`/api/invoices/${invoice.id}/email`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_email: clientEmail,
          subject: `Invoice #${invoice.invoice_number}`,
          message: `Please find attached Invoice #${invoice.invoice_number}.`,
        }),
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
      Alert.alert('Email Sent', `Invoice #${invoice.invoice_number} has been emailed to ${clientEmail}`);
    } catch (e: any) {
      Alert.alert('Error', mapFetchFailureMessage(e));
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
            <View style={styles.companyCol}>
              <Text style={styles.companyName}>{COMPANY.name}</Text>
              {COMPANY.address.map((line, i) => (
                <Text key={i} style={styles.companyAddr}>{line}</Text>
              ))}
              <Text style={styles.companyAddr}>{COMPANY.phone}</Text>
              <Text style={styles.companyAddr}>{COMPANY.email}</Text>
              <Text style={styles.companyAbn}>{COMPANY.abn}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Tax Invoice Title */}
          <Text style={styles.taxInvoiceTitle}>Tax Invoice</Text>

          {/* Client + Invoice Details */}
          <View style={styles.twoCol}>
            <View style={styles.colLeft}>
              <Text style={styles.invoiceToLabel}>INVOICE TO</Text>
              <Text style={styles.clientName}>{client.company_name || '—'}</Text>
              {[client.address_line1, client.address_line2, client.address_line3].filter(Boolean).map((l, i) => (
                <Text key={i} style={styles.clientAddr}>{l}</Text>
              ))}
              {client.contact_name ? <Text style={styles.clientAddr}>{client.contact_name}</Text> : null}
              {client.company_email ? <Text style={styles.clientEmail}>{client.company_email}</Text> : null}
            </View>
            <View style={styles.colRight}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>INVOICE</Text>
                <Text style={styles.metaValue}>{invoice.invoice_number || '—'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>DATE</Text>
                <Text style={styles.metaValue}>{invoice.invoice_date || '—'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>DUE DATE</Text>
                <Text style={styles.metaValue}>{invoice.due_date || '—'}</Text>
              </View>
            </View>
          </View>

          {/* Line Items Table */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 1.2 }]}>DATE</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>{''}</Text>
              <Text style={[styles.th, { flex: 2.5 }]}>DESCRIPTION</Text>
              <Text style={[styles.th, { flex: 0.8, textAlign: 'center' }]}>GST</Text>
              <Text style={[styles.th, { flex: 0.6, textAlign: 'center' }]}>QTY</Text>
              <Text style={[styles.th, { flex: 0.8, textAlign: 'right' }]}>RATE</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>AMOUNT</Text>
            </View>
            {invoice.line_items.map((item, idx) => (
              <View key={item.id} style={styles.tableRow} testID={`preview-item-${idx}`}>
                <Text style={[styles.td, { flex: 1.2 }]}>{item.service_date || '—'}</Text>
                <Text style={[styles.td, styles.tdBold, { flex: 1.5 }]} numberOfLines={1}>{item.product || ''}</Text>
                <Text style={[styles.td, { flex: 2.5 }]}>{item.description || '—'}</Text>
                <Text style={[styles.td, { flex: 0.8, textAlign: 'center' }]}>{item.gst_applicable ? 'GST' : ''}</Text>
                <Text style={[styles.td, { flex: 0.6, textAlign: 'center' }]}>{item.quantity}</Text>
                <Text style={[styles.td, { flex: 0.8, textAlign: 'right' }]}>{item.rate.toFixed(2)}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>{(item.quantity * item.rate).toFixed(2)}</Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totals}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>SUBTOTAL</Text>
              <Text style={styles.totalsValue} testID="preview-subtotal">{totals.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>GST TOTAL</Text>
              <Text style={styles.totalsValue} testID="preview-gst">{totals.gst_total.toFixed(2)}</Text>
            </View>
            <View style={[styles.totalsRow, styles.totalLine]}>
              <Text style={styles.totalsLabel}>TOTAL</Text>
              <Text style={styles.totalsValue} testID="preview-total">{totals.total.toFixed(2)}</Text>
            </View>
            <View style={styles.balanceDueRow}>
              <Text style={styles.balanceDueLabel}>BALANCE DUE</Text>
              <Text style={styles.balanceDueValue} testID="preview-balance">A${totals.total.toFixed(2)}</Text>
            </View>
          </View>

          {/* Bank Details Box */}
          <View style={styles.bankBox}>
            <Text style={styles.bankTitle}>{BANK.title}</Text>
            <Text style={styles.bankText}>ACCOUNT NAME: {BANK.account_name}</Text>
            <Text style={styles.bankText}>{'\n'}BSB NO: {BANK.bsb}</Text>
            <Text style={styles.bankText}>ACCOUNT NO: {BANK.account_no}</Text>
          </View>

          {/* Footer */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>THANKYOU FOR YOUR BUSINESS</Text>
            <Text style={styles.footerText}>Page 1 of 1</Text>
          </View>
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
          onPress={handleEmailInvoice}
          disabled={emailing}
          testID="email-invoice-btn"
        >
          {emailing ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Ionicons name="mail-outline" size={20} color="#FFF" />
              <Text style={styles.emailBtnText}>Email Invoice</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    borderRadius: 2,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paperHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  companyCol: { flex: 1 },
  companyName: { fontSize: 13, fontWeight: '700', color: '#000', marginBottom: 3 },
  companyAddr: { fontSize: 9, color: '#555', lineHeight: 14 },
  companyAbn: { fontSize: 9, fontWeight: '700', color: '#000', marginTop: 1 },
  divider: { height: 0.5, backgroundColor: '#CCC', marginVertical: 10 },
  taxInvoiceTitle: { fontSize: 20, fontWeight: '400', color: '#7BA7C9', marginBottom: 8 },
  twoCol: { flexDirection: 'row', marginBottom: 14 },
  colLeft: { flex: 1 },
  colRight: { flex: 1, alignItems: 'flex-end' },
  invoiceToLabel: { fontSize: 9, fontWeight: '400', color: '#999', marginBottom: 3 },
  clientName: { fontSize: 11, fontWeight: '700', color: '#000', marginBottom: 2 },
  clientAddr: { fontSize: 9, color: '#333', lineHeight: 14 },
  clientEmail: { fontSize: 9, color: '#2563EB', lineHeight: 14 },
  metaRow: { flexDirection: 'row', gap: 12, marginBottom: 2 },
  metaLabel: { fontSize: 9, color: '#999', width: 55 },
  metaValue: { fontSize: 9, color: '#000', fontWeight: '500' },
  table: { marginBottom: 10 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#DCE8F2',
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  th: { fontSize: 8, fontWeight: '700', color: '#7BA7C9' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  td: { fontSize: 9, color: '#333' },
  tdBold: { fontWeight: '700', color: '#000' },
  totals: { alignItems: 'flex-end', marginBottom: 10 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '55%', paddingVertical: 3 },
  totalsLabel: { fontSize: 9, fontWeight: '400', color: '#999' },
  totalsValue: { fontSize: 9, color: '#000', fontWeight: '500' },
  totalLine: { borderBottomWidth: 0.5, borderBottomColor: '#CCC' },
  balanceDueRow: { flexDirection: 'row', justifyContent: 'space-between', width: '55%', paddingTop: 6, alignItems: 'center' },
  balanceDueLabel: { fontSize: 10, fontWeight: '400', color: '#999' },
  balanceDueValue: { fontSize: 16, fontWeight: '800', color: '#000' },
  bankBox: {
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    padding: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  bankTitle: { fontSize: 9, fontWeight: '700', color: '#000', marginBottom: 6 },
  bankText: { fontSize: 9, fontWeight: '700', color: '#000', lineHeight: 16 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  footerText: { fontSize: 8, color: '#CCC' },
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
});
