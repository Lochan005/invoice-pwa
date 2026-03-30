export interface LineItem {
  id: string;
  service_date: string;
  product: string;
  description: string;
  gst_applicable: boolean;
  quantity: number;
  rate: number;
}

export interface CompanyDetails {
  company_name: string;
  company_email: string;
  contact_name: string;
  address_line1: string;
  address_line2: string;
  address_line3: string;
  phone: string;
  abn: string;
}

export interface BankDetails {
  account_name: string;
  bsb: string;
  account_number: string;
}

export interface Invoice {
  id?: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  company_details: CompanyDetails;
  client_details: CompanyDetails;
  bank_details: BankDetails;
  line_items: LineItem[];
  subtotal: number;
  gst_total: number;
  total: number;
  notes: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export const emptyCompanyDetails: CompanyDetails = {
  company_name: '',
  company_email: '',
  contact_name: '',
  address_line1: '',
  address_line2: '',
  address_line3: '',
  phone: '',
  abn: '',
};

export const emptyBankDetails: BankDetails = {
  account_name: '',
  bsb: '',
  account_number: '',
};

export const createEmptyLineItem = (): LineItem => ({
  id: Math.random().toString(36).substring(2, 15),
  service_date: '',
  product: '',
  description: '',
  gst_applicable: true,
  quantity: 1,
  rate: 0,
});

export const createEmptyInvoice = (): Invoice => ({
  invoice_number: '',
  invoice_date: '',
  due_date: '',
  company_details: { ...emptyCompanyDetails },
  client_details: { ...emptyCompanyDetails },
  bank_details: { ...emptyBankDetails },
  line_items: [createEmptyLineItem()],
  subtotal: 0,
  gst_total: 0,
  total: 0,
  notes: '',
});
