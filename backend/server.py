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

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, Image
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

# --- Hardcoded Company & Bank Details ---
COMPANY_NAME = "The trustee for SAITECH TRADING TRUST"
COMPANY_ADDRESS = ["33 LOWANNAWAY", "ARMADALE WA  6112"]
COMPANY_PHONE = "+61 470530451"
COMPANY_EMAIL = "shiva.prasad1947@gmail.com"
COMPANY_ABN = "ABN 39315636679"
BANK_ACCOUNT_NAME = "SAITECH ENGINEERING PTY LTD"
BANK_BSB = "086006"
BANK_ACCOUNT_NO = "925720296"
LOGO_PATH = Path(__file__).parent / "saitech_logo.png"

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

def upload_to_drive(invoice: Invoice, pdf_bytes: bytes):
    folder_id = os.environ.get('GOOGLE_DRIVE_FOLDER_ID')
    creds_json_str = os.environ.get('GOOGLE_CREDENTIALS_JSON')
    if not folder_id or not creds_json_str:
        logger.warning(f"Drive config missing (Folder ID: {bool(folder_id)}, Creds: {bool(creds_json_str)}). Skipping upload.")
        return

    try:
        import json
        SCOPES = ['https://www.googleapis.com/auth/drive.file']
        creds_info = json.loads(creds_json_str)
        creds = service_account.Credentials.from_service_account_info(creds_info, scopes=SCOPES)
        service = build('drive', 'v3', credentials=creds)
        file_name = f'Invoice_{invoice.invoice_number}.pdf'
        
        media = MediaIoBaseUpload(io.BytesIO(pdf_bytes), mimetype='application/pdf', resumable=True)
        query = f"name='{file_name}' and '{folder_id}' in parents and trashed=false"
        results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        items = results.get('files', [])
        
        if not items:
            file_metadata = {'name': file_name, 'parents': [folder_id]}
            service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        else:
            file_id = items[0]['id']
            service.files().update(fileId=file_id, media_body=media).execute()
            
        logger.info(f"Successfully uploaded {file_name} to Drive.")
    except Exception as e:
        logger.error(f"Failed to upload to drive: {e}")

def generate_invoice_pdf(invoice: Invoice) -> bytes:
    buffer = io.BytesIO()
    page_w, page_h = A4
    left_margin = 15*mm
    right_margin = 15*mm
    top_margin = 15*mm
    bottom_margin = 20*mm
    content_width = page_w - left_margin - right_margin

    styles = getSampleStyleSheet()

    # --- Styles matching reference exactly ---
    s_company = ParagraphStyle('CompanyName', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=colors.black)
    s_addr = ParagraphStyle('Addr', fontName='Helvetica', fontSize=9, leading=12, textColor=colors.HexColor('#333333'))
    s_addr_bold = ParagraphStyle('AddrBold', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=colors.black)
    s_tax_title = ParagraphStyle('TaxTitle', fontName='Helvetica', fontSize=18, leading=22, textColor=colors.HexColor('#7BA7C9'))
    s_invoice_to_label = ParagraphStyle('InvToLabel', fontName='Helvetica', fontSize=9, leading=12, textColor=colors.HexColor('#999999'))
    s_client_name = ParagraphStyle('ClientName', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=colors.black)
    s_client_addr = ParagraphStyle('ClientAddr', fontName='Helvetica', fontSize=9, leading=12, textColor=colors.black)
    s_meta_label = ParagraphStyle('MetaLabel', fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#999999'))
    s_meta_value = ParagraphStyle('MetaValue', fontName='Helvetica', fontSize=9, leading=13, textColor=colors.black, alignment=TA_RIGHT)
    s_th = ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=colors.HexColor('#7BA7C9'))
    s_td = ParagraphStyle('TD', fontName='Helvetica', fontSize=9, leading=12, textColor=colors.black)
    s_td_bold = ParagraphStyle('TDBold', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=colors.black)
    s_td_right = ParagraphStyle('TDRight', fontName='Helvetica', fontSize=9, leading=12, textColor=colors.black, alignment=TA_RIGHT)
    s_totals_label = ParagraphStyle('TotLabel', fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#999999'), alignment=TA_RIGHT)
    s_totals_value = ParagraphStyle('TotValue', fontName='Helvetica', fontSize=9, leading=13, textColor=colors.black, alignment=TA_RIGHT)
    s_balance_label = ParagraphStyle('BalLabel', fontName='Helvetica', fontSize=10, leading=14, textColor=colors.HexColor('#999999'), alignment=TA_RIGHT)
    s_balance_value = ParagraphStyle('BalValue', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=colors.black, alignment=TA_RIGHT)
    s_bank_title = ParagraphStyle('BankTitle', fontName='Helvetica-Bold', fontSize=9, leading=14, textColor=colors.black)
    s_bank_text = ParagraphStyle('BankText', fontName='Helvetica-Bold', fontSize=9, leading=14, textColor=colors.black)
    s_footer = ParagraphStyle('Footer', fontName='Helvetica', fontSize=8, leading=10, textColor=colors.HexColor('#CCCCCC'))
    s_footer_right = ParagraphStyle('FooterR', fontName='Helvetica', fontSize=8, leading=10, textColor=colors.HexColor('#CCCCCC'), alignment=TA_RIGHT)

    elements = []

    # === 1. HEADER: Company details (left) + Logo (right) ===
    company_block = []
    company_block.append(Paragraph(f"<b>{COMPANY_NAME}</b>", s_company))
    for line in COMPANY_ADDRESS:
        company_block.append(Paragraph(line, s_addr))
    company_block.append(Paragraph(COMPANY_PHONE, s_addr))
    company_block.append(Paragraph(COMPANY_EMAIL, s_addr))
    company_block.append(Paragraph(f"<b>{COMPANY_ABN}</b>", s_addr_bold))

    # Logo
    logo_cell = ""
    if LOGO_PATH.exists():
        logo_cell = Image(str(LOGO_PATH), width=75, height=56)

    header_table = Table(
        [[company_block, logo_cell]],
        colWidths=[content_width - 80, 80]
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 4*mm))

    # Horizontal line
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#CCCCCC')))
    elements.append(Spacer(1, 8*mm))

    # === 2. TAX INVOICE title ===
    elements.append(Paragraph("Tax Invoice", s_tax_title))
    elements.append(Spacer(1, 4*mm))

    # === 3. INVOICE TO (left) + Invoice metadata (right) ===
    client = invoice.client_details
    left_block = []
    left_block.append(Paragraph("INVOICE TO", s_invoice_to_label))
    if client.company_name:
        left_block.append(Paragraph(client.company_name, s_client_name))
    for line in [client.address_line1, client.address_line2, client.address_line3]:
        if line:
            left_block.append(Paragraph(line, s_client_addr))
    if client.contact_name:
        left_block.append(Paragraph(client.contact_name, s_client_addr))

    meta_data = [
        [Paragraph("INVOICE", s_meta_label), Paragraph(invoice.invoice_number or "—", s_meta_value)],
        [Paragraph("DATE", s_meta_label), Paragraph(invoice.invoice_date or "—", s_meta_value)],
        [Paragraph("DUE DATE", s_meta_label), Paragraph(invoice.due_date or "—", s_meta_value)],
    ]
    meta_table = Table(meta_data, colWidths=[60, 80])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))

    info_table = Table([[left_block, meta_table]], colWidths=[content_width - 160, 160])
    info_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    elements.append(info_table)
    elements.append(Spacer(1, 8*mm))

    # === 4. LINE ITEMS TABLE ===
    light_blue = colors.HexColor('#DCE8F2')
    th_style = s_th

    table_header = [
        Paragraph("DATE", th_style),
        Paragraph("", th_style),  # product column (no header text)
        Paragraph("DESCRIPTION", th_style),
        Paragraph("GST", th_style),
        Paragraph("QTY", th_style),
        Paragraph("RATE", th_style),
        Paragraph("AMOUNT", th_style),
    ]
    table_data = [table_header]

    for item in invoice.line_items:
        amt = item.quantity * item.rate
        qty_str = str(int(item.quantity)) if item.quantity == int(item.quantity) else str(item.quantity)
        table_data.append([
            Paragraph(item.service_date, s_td),
            Paragraph(item.product, s_td_bold),
            Paragraph(item.description, s_td),
            Paragraph("GST" if item.gst_applicable else "", s_td),
            Paragraph(qty_str, s_td),
            Paragraph(f"{item.rate:.2f}", s_td_right),
            Paragraph(f"{amt:.2f}", s_td_right),
        ])

    if not invoice.line_items:
        table_data.append([Paragraph("", s_td)] * 7)

    col_widths = [62, 72, content_width - 62 - 72 - 40 - 35 - 45 - 60, 40, 35, 45, 60]
    line_table = Table(table_data, colWidths=col_widths)
    line_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), light_blue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#7BA7C9')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, colors.HexColor('#B0C4DE')),
        ('LINEBELOW', (0, -1), (-1, -1), 0.5, colors.HexColor('#CCCCCC'), None, (2, 2)),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 6*mm))

    # === 5. TOTALS ===
    totals_data = [
        ["", Paragraph("SUBTOTAL", s_totals_label), Paragraph(f"{invoice.subtotal:.2f}", s_totals_value)],
        ["", Paragraph("GST TOTAL", s_totals_label), Paragraph(f"{invoice.gst_total:.2f}", s_totals_value)],
        ["", Paragraph("TOTAL", s_totals_label), Paragraph(f"{invoice.total:.2f}", s_totals_value)],
    ]
    totals_table = Table(totals_data, colWidths=[content_width - 200, 120, 80])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LINEBELOW', (1, -1), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 3*mm))

    # BALANCE DUE
    balance_data = [["", Paragraph("BALANCE DUE", s_balance_label), Paragraph(f"A${invoice.total:,.2f}", s_balance_value)]]
    balance_table = Table(balance_data, colWidths=[content_width - 200, 120, 80])
    balance_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(balance_table)
    elements.append(Spacer(1, 10*mm))

    # === 6. BANK DETAILS (gray box) ===
    bank_content = f"""<b>BANK DETAILS;</b><br/><br/>
<b>ACCOUNT NAME: {BANK_ACCOUNT_NAME}</b><br/><br/>
<b>BSB NO: {BANK_BSB}</b><br/>
<b>ACCOUNT NO: {BANK_ACCOUNT_NO}</b>"""

    bank_style = ParagraphStyle('BankBox', fontName='Helvetica-Bold', fontSize=9, leading=13,
                                 textColor=colors.black, backColor=colors.HexColor('#F0F0F0'),
                                 borderPadding=(10, 10, 10, 10))
    bank_para = Paragraph(bank_content, bank_style)

    bank_box_table = Table([[bank_para]], colWidths=[content_width])
    bank_box_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F0F0F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    elements.append(bank_box_table)

    # === 7. FOOTER ===
    elements.append(Spacer(1, 30*mm))
    footer_data = [[Paragraph("THANKYOU FOR YOUR BUSINESS", s_footer), Paragraph("Page 1 of 1", s_footer_right)]]
    footer_table = Table(footer_data, colWidths=[content_width * 0.5, content_width * 0.5])
    elements.append(footer_table)

    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            topMargin=top_margin, bottomMargin=bottom_margin,
                            leftMargin=left_margin, rightMargin=right_margin)
    doc.build(elements)
    return buffer.getvalue()

# --- Routes ---
@api_router.get("/")
async def root():
    return {"message": "Invoice Generator API"}

@api_router.get("/invoices/next-number")
async def get_next_invoice_number():
    invoices = await db.invoices.find({}, {"invoice_number": 1, "_id": 0}).to_list(1000)
    numbers = []
    for inv in invoices:
        try:
            numbers.append(int(inv.get("invoice_number", "0")))
        except (ValueError, TypeError):
            pass
    next_num = max(numbers) + 1 if numbers else 1
    return {"next_number": str(next_num).zfill(3)}

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
    payload = data.model_dump()
    invoice = Invoice(**payload, subtotal=subtotal, gst_total=gst_total, total=total)
    invoice_dict = invoice.model_dump()
    await db.invoices.insert_one({**invoice_dict})
    
    # Upload to Google Drive in the background
    try:
        pdf_bytes = generate_invoice_pdf(invoice)
        asyncio.create_task(asyncio.to_thread(upload_to_drive, invoice, pdf_bytes))
    except Exception as e:
        logger.error(f"Failed to initiate drive upload on create: {e}")
        
    return invoice_dict

@api_router.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, data: InvoiceCreate):
    subtotal, gst_total, total = calculate_totals(data.line_items)
    update_dict = data.model_dump()
    update_dict.update(subtotal=subtotal, gst_total=gst_total, total=total, updated_at=datetime.now(timezone.utc).isoformat())
    result = await db.invoices.update_one({"id": invoice_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    updated_doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    
    # Upload to Google Drive in the background
    try:
        invoice = Invoice(**updated_doc)
        pdf_bytes = generate_invoice_pdf(invoice)
        asyncio.create_task(asyncio.to_thread(upload_to_drive, invoice, pdf_bytes))
    except Exception as e:
        logger.error(f"Failed to initiate drive upload on update: {e}")
        
    return updated_doc

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
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
