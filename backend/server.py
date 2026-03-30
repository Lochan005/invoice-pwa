from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import base64
import io
import resend

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Models ---
class LineItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    service_date: str = ""
    product: str = ""
    description: str = ""
    gst_applicable: bool = True
    quantity: float = 1
    rate: float = 0.0

class CompanyDetails(BaseModel):
    company_name: str = ""
    company_email: str = ""
    contact_name: str = ""
    address_line1: str = ""
    address_line2: str = ""
    address_line3: str = ""
    phone: str = ""
    abn: str = ""

class BankDetails(BaseModel):
    account_name: str = ""
    bsb: str = ""
    account_number: str = ""

class InvoiceCreate(BaseModel):
    invoice_number: str = ""
    invoice_date: str = ""
    due_date: str = ""
    company_details: CompanyDetails = Field(default_factory=CompanyDetails)
    client_details: CompanyDetails = Field(default_factory=CompanyDetails)
    bank_details: BankDetails = Field(default_factory=BankDetails)
    line_items: List[LineItem] = Field(default_factory=list)
    notes: str = ""

class Invoice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str = ""
    invoice_date: str = ""
    due_date: str = ""
    company_details: CompanyDetails = Field(default_factory=CompanyDetails)
    client_details: CompanyDetails = Field(default_factory=CompanyDetails)
    bank_details: BankDetails = Field(default_factory=BankDetails)
    line_items: List[LineItem] = Field(default_factory=list)
    subtotal: float = 0.0
    gst_total: float = 0.0
    total: float = 0.0
    notes: str = ""
    status: str = "saved"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class EmailRequest(BaseModel):
    recipient_email: EmailStr
    subject: str = ""
    message: str = ""

# --- Helpers ---
def calculate_totals(line_items: List[LineItem]):
    subtotal = sum(item.quantity * item.rate for item in line_items)
    gst_total = sum(item.quantity * item.rate * 0.10 for item in line_items if item.gst_applicable)
    total = subtotal + gst_total
    return round(subtotal, 2), round(gst_total, 2), round(total, 2)

def generate_invoice_pdf(invoice: Invoice) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm, leftMargin=15*mm, rightMargin=15*mm)
    styles = getSampleStyleSheet()
    elements = []
    page_width = A4[0] - 30*mm

    title_style = ParagraphStyle('InvTitle', parent=styles['Title'], fontSize=24, textColor=colors.HexColor('#2563EB'), fontName='Helvetica-Bold', alignment=TA_LEFT, spaceAfter=2*mm)
    heading_style = ParagraphStyle('Heading', parent=styles['Normal'], fontSize=11, fontName='Helvetica-Bold', textColor=colors.HexColor('#111827'), spaceAfter=2*mm)
    normal_style = ParagraphStyle('Norm', parent=styles['Normal'], fontSize=9, fontName='Helvetica', textColor=colors.HexColor('#374151'), leading=13)
    bold_style = ParagraphStyle('Bold', parent=styles['Normal'], fontSize=9, fontName='Helvetica-Bold', textColor=colors.HexColor('#111827'), leading=13)
    right_style = ParagraphStyle('Right', parent=styles['Normal'], fontSize=9, fontName='Helvetica', textColor=colors.HexColor('#374151'), alignment=TA_RIGHT, leading=13)
    small_style = ParagraphStyle('Small', parent=styles['Normal'], fontSize=8, fontName='Helvetica-Bold', textColor=colors.HexColor('#6B7280'))
    center_style = ParagraphStyle('Center', parent=styles['Normal'], fontSize=10, fontName='Helvetica-Bold', textColor=colors.HexColor('#6B7280'), alignment=TA_CENTER)

    # Company name header
    company = invoice.company_details
    if company.company_name:
        elements.append(Paragraph(company.company_name, ParagraphStyle('CompName', parent=bold_style, fontSize=14)))
    elements.append(Paragraph("Tax Invoice", title_style))

    # Company details
    for line in [company.address_line1, company.address_line2, company.address_line3, company.phone, company.company_email]:
        if line:
            elements.append(Paragraph(line, normal_style))
    if company.abn:
        elements.append(Paragraph(f"ABN {company.abn}", normal_style))
    elements.append(Spacer(1, 6*mm))

    # Two column: Invoice To | Invoice details
    client = invoice.client_details
    client_lines = "<b>Invoice To:</b><br/>"
    if client.company_name:
        client_lines += f"<b>{client.company_name}</b><br/>"
    for line in [client.contact_name, client.address_line1, client.address_line2, client.company_email]:
        if line:
            client_lines += f"{line}<br/>"

    inv_lines = f"<b>INVOICE</b>  {invoice.invoice_number}<br/><b>DATE</b>  {invoice.invoice_date or '—'}<br/><b>DUE DATE</b>  {invoice.due_date or '—'}"

    header_table = Table([
        [Paragraph(client_lines, normal_style), Paragraph(inv_lines, right_style)]
    ], colWidths=[page_width * 0.55, page_width * 0.45])
    header_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    elements.append(header_table)
    elements.append(Spacer(1, 6*mm))

    # Line items table
    table_header = [
        Paragraph("<b>Date</b>", small_style),
        Paragraph("<b>Product</b>", small_style),
        Paragraph("<b>Description</b>", small_style),
        Paragraph("<b>GST</b>", small_style),
        Paragraph("<b>Qty</b>", small_style),
        Paragraph("<b>Rate</b>", small_style),
        Paragraph("<b>Amount</b>", small_style),
    ]
    table_data = [table_header]
    for item in invoice.line_items:
        amt = item.quantity * item.rate
        table_data.append([
            Paragraph(item.service_date, normal_style),
            Paragraph(item.product, normal_style),
            Paragraph(item.description, normal_style),
            Paragraph("Yes" if item.gst_applicable else "No", normal_style),
            Paragraph(str(int(item.quantity) if item.quantity == int(item.quantity) else item.quantity), normal_style),
            Paragraph(f"${item.rate:.2f}", right_style),
            Paragraph(f"${amt:.2f}", right_style),
        ])
    if not invoice.line_items:
        table_data.append([Paragraph("—", normal_style)] * 7)

    col_widths = [55, 70, 95, 30, 30, 50, 55]
    line_table = Table(table_data, colWidths=col_widths)
    line_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F3F4F6')),
        ('ALIGN', (-2, 1), (-1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 4*mm))

    # Totals
    totals_bold = ParagraphStyle('TB', parent=bold_style, fontSize=11, alignment=TA_RIGHT)
    totals_data = [
        [Paragraph("SUBTOTAL", bold_style), Paragraph(f"${invoice.subtotal:.2f}", right_style)],
        [Paragraph("GST TOTAL", bold_style), Paragraph(f"${invoice.gst_total:.2f}", right_style)],
        [Paragraph("TOTAL", bold_style), Paragraph(f"${invoice.total:.2f}", right_style)],
        [Paragraph("BALANCE DUE", ParagraphStyle('BD', parent=bold_style, fontSize=11)),
         Paragraph(f"A${invoice.total:.2f}", totals_bold)],
    ]
    totals_table = Table(totals_data, colWidths=[page_width - 100, 100])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor('#2563EB')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 8*mm))

    # Bank details
    bank = invoice.bank_details
    if bank.account_name or bank.bsb or bank.account_number:
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#E5E7EB')))
        elements.append(Spacer(1, 2*mm))
        elements.append(Paragraph("BANK DETAILS", heading_style))
        if bank.account_name:
            elements.append(Paragraph(f"ACCOUNT NAME: {bank.account_name}", normal_style))
        if bank.bsb:
            elements.append(Paragraph(f"BSB NO: {bank.bsb}", normal_style))
        if bank.account_number:
            elements.append(Paragraph(f"ACCOUNT NO: {bank.account_number}", normal_style))
        elements.append(Spacer(1, 6*mm))

    elements.append(Paragraph("THANK YOU FOR YOUR BUSINESS", center_style))
    doc.build(elements)
    return buffer.getvalue()

# --- Routes ---
@api_router.get("/")
async def root():
    return {"message": "Invoice Generator API"}

@api_router.get("/invoices/next-number")
async def get_next_invoice_number():
    count = await db.invoices.count_documents({})
    return {"next_number": str(count + 1).zfill(3)}

@api_router.get("/invoices")
async def list_invoices():
    invoices = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return invoices

@api_router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@api_router.post("/invoices")
async def create_invoice(data: InvoiceCreate):
    subtotal, gst_total, total = calculate_totals(data.line_items)
    invoice = Invoice(**data.dict(), subtotal=subtotal, gst_total=gst_total, total=total)
    invoice_dict = invoice.dict()
    await db.invoices.insert_one({**invoice_dict})
    return invoice_dict

@api_router.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, data: InvoiceCreate):
    subtotal, gst_total, total = calculate_totals(data.line_items)
    update_dict = data.dict()
    update_dict.update(subtotal=subtotal, gst_total=gst_total, total=total, updated_at=datetime.now(timezone.utc).isoformat())
    result = await db.invoices.update_one({"id": invoice_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return await db.invoices.find_one({"id": invoice_id}, {"_id": 0})

@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str):
    result = await db.invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"status": "deleted"}

@api_router.post("/invoices/{invoice_id}/pdf")
async def generate_pdf(invoice_id: str):
    invoice_data = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice_data:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice = Invoice(**invoice_data)
    pdf_bytes = generate_invoice_pdf(invoice)
    pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
    return {"pdf_base64": pdf_base64, "filename": f"invoice_{invoice.invoice_number}.pdf"}

@api_router.post("/invoices/{invoice_id}/email")
async def email_invoice(invoice_id: str, email_request: EmailRequest):
    invoice_data = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice_data:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice = Invoice(**invoice_data)
    pdf_bytes = generate_invoice_pdf(invoice)

    subject = email_request.subject or f"Invoice #{invoice.invoice_number}"
    message = email_request.message or f"Please find attached Invoice #{invoice.invoice_number}."
    html_content = f"""<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#2563EB;">Invoice #{invoice.invoice_number}</h2>
        <p>{message}</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>From:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">{invoice.company_details.company_name}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>To:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">{invoice.client_details.company_name}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Amount:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">A${invoice.total:.2f}</td></tr>
            <tr><td style="padding:8px;"><strong>Due Date:</strong></td><td style="padding:8px;">{invoice.due_date}</td></tr>
        </table>
    </div>"""

    params = {
        "from": SENDER_EMAIL,
        "to": [email_request.recipient_email],
        "subject": subject,
        "html": html_content,
        "attachments": [{"filename": f"invoice_{invoice.invoice_number}.pdf", "content": list(pdf_bytes)}],
    }
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        return {"status": "success", "message": f"Invoice emailed to {email_request.recipient_email}", "email_id": email.get("id")}
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
