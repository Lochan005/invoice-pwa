import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  Invoice,
  CompanyDetails,
  BankDetails,
  LineItem,
  createEmptyInvoice,
  createEmptyLineItem,
} from '../types/invoice';

interface InvoiceContextType {
  invoice: Invoice;
  setInvoice: React.Dispatch<React.SetStateAction<Invoice>>;
  updateCompany: (field: keyof CompanyDetails, value: string) => void;
  updateClient: (field: keyof CompanyDetails, value: string) => void;
  updateBank: (field: keyof BankDetails, value: string) => void;
  updateField: (field: keyof Invoice, value: string) => void;
  addLineItem: () => void;
  removeLineItem: (id: string) => void;
  updateLineItem: (id: string, field: keyof LineItem, value: any) => void;
  resetInvoice: () => void;
  loadInvoice: (inv: Invoice) => void;
  totals: { subtotal: number; gst_total: number; total: number };
}

const InvoiceContext = createContext<InvoiceContextType | undefined>(undefined);

export function InvoiceProvider({ children }: { children: React.ReactNode }) {
  const [invoice, setInvoice] = useState<Invoice>(createEmptyInvoice());

  const updateCompany = useCallback((field: keyof CompanyDetails, value: string) => {
    setInvoice(prev => ({
      ...prev,
      company_details: { ...prev.company_details, [field]: value },
    }));
  }, []);

  const updateClient = useCallback((field: keyof CompanyDetails, value: string) => {
    setInvoice(prev => ({
      ...prev,
      client_details: { ...prev.client_details, [field]: value },
    }));
  }, []);

  const updateBank = useCallback((field: keyof BankDetails, value: string) => {
    setInvoice(prev => ({
      ...prev,
      bank_details: { ...prev.bank_details, [field]: value },
    }));
  }, []);

  const updateField = useCallback((field: keyof Invoice, value: string) => {
    setInvoice(prev => ({ ...prev, [field]: value }));
  }, []);

  const addLineItem = useCallback(() => {
    setInvoice(prev => ({
      ...prev,
      line_items: [...prev.line_items, createEmptyLineItem()],
    }));
  }, []);

  const removeLineItem = useCallback((id: string) => {
    setInvoice(prev => ({
      ...prev,
      line_items: prev.line_items.length > 1
        ? prev.line_items.filter(item => item.id !== id)
        : prev.line_items,
    }));
  }, []);

  const updateLineItem = useCallback((id: string, field: keyof LineItem, value: any) => {
    setInvoice(prev => ({
      ...prev,
      line_items: prev.line_items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  }, []);

  const resetInvoice = useCallback(() => {
    setInvoice(createEmptyInvoice());
  }, []);

  const loadInvoice = useCallback((inv: Invoice) => {
    setInvoice(inv);
  }, []);

  const totals = useMemo(() => {
    const subtotal = invoice.line_items.reduce(
      (sum, item) => sum + item.quantity * item.rate,
      0
    );
    const gst_total = invoice.line_items.reduce(
      (sum, item) => sum + (item.gst_applicable ? item.quantity * item.rate * 0.1 : 0),
      0
    );
    return { subtotal, gst_total, total: subtotal + gst_total };
  }, [invoice.line_items]);

  return (
    <InvoiceContext.Provider
      value={{
        invoice,
        setInvoice,
        updateCompany,
        updateClient,
        updateBank,
        updateField,
        addLineItem,
        removeLineItem,
        updateLineItem,
        resetInvoice,
        loadInvoice,
        totals,
      }}
    >
      {children}
    </InvoiceContext.Provider>
  );
}

export function useInvoice() {
  const ctx = useContext(InvoiceContext);
  if (!ctx) throw new Error('useInvoice must be used within InvoiceProvider');
  return ctx;
}
