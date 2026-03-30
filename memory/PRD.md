# Invoice Generator App - PRD

## Overview
A professional invoice generator mobile app (Expo/React Native) that allows users to create, preview, save, and email invoices with PDF generation capability.

## Tech Stack
- **Frontend**: React Native (Expo SDK 54), Expo Router, TypeScript
- **Backend**: FastAPI (Python), Motor (async MongoDB), ReportLab (PDF generation)
- **Database**: MongoDB
- **Email**: Resend API (with PDF attachment support)

## Features
### Core
- **Splash Screen**: Blue branded screen with "Invoice Generator" text, auto-redirects to Create tab
- **Create Invoice**: Multi-section scrollable form with Company Details, Client Details, Invoice Details, Bank Details, Line Items
- **Line Items Management**: Add/remove items, per-item GST toggle, auto-calculated amounts
- **Live Totals**: Real-time subtotal, GST (10%), and balance due calculation
- **Invoice Preview**: Paper-style PDF-like preview with professional layout
- **PDF Download**: Backend-generated PDF via ReportLab, downloadable on web and mobile
- **Email Invoice**: Send invoice with PDF attachment via Resend
- **Saved Invoices**: List of saved invoices with load, edit, delete functionality
- **Pull-to-refresh**: On Saved Invoices list

### Navigation
- Tab-based navigation: Create | Preview | Saved
- Stack navigation at root level with Splash → Tabs flow

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/invoices | List all invoices |
| GET | /api/invoices/next-number | Get next invoice number |
| GET | /api/invoices/{id} | Get single invoice |
| POST | /api/invoices | Create invoice |
| PUT | /api/invoices/{id} | Update invoice |
| DELETE | /api/invoices/{id} | Delete invoice |
| POST | /api/invoices/{id}/pdf | Generate PDF (base64) |
| POST | /api/invoices/{id}/email | Email invoice with PDF |

## Environment Variables
### Backend (.env)
- MONGO_URL: MongoDB connection string
- DB_NAME: Database name
- RESEND_API_KEY: Resend email service API key
- SENDER_EMAIL: Sender email address

### Frontend (.env)
- EXPO_PUBLIC_BACKEND_URL: Backend API base URL

## Limitations
- Resend is in test mode: emails only sent to verified addresses
- No authentication (single-user app by design)
