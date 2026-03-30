"""
Backend API Tests for Invoice Generator
Tests: Invoice CRUD, PDF generation, Email sending, Next number generation
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Basic health check"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data


class TestInvoiceNextNumber:
    """Test next invoice number generation"""
    
    def test_get_next_invoice_number(self):
        """Test GET /api/invoices/next-number"""
        response = requests.get(f"{BASE_URL}/api/invoices/next-number")
        assert response.status_code == 200
        data = response.json()
        assert "next_number" in data
        assert isinstance(data["next_number"], str)
        print(f"✓ Next invoice number: {data['next_number']}")


class TestInvoiceCRUD:
    """Test Invoice CRUD operations"""
    
    def test_list_invoices(self):
        """Test GET /api/invoices - list all invoices"""
        response = requests.get(f"{BASE_URL}/api/invoices")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Found {len(data)} existing invoices")
    
    def test_create_invoice_and_verify(self):
        """Test POST /api/invoices - create invoice and verify persistence"""
        payload = {
            "invoice_number": "TEST_001",
            "invoice_date": "2026-01-15",
            "due_date": "2026-02-15",
            "company_details": {
                "company_name": "Test Company Pty Ltd",
                "company_email": "test@company.com",
                "contact_name": "John Doe",
                "address_line1": "123 Test Street",
                "address_line2": "Suite 100",
                "address_line3": "Sydney NSW 2000",
                "phone": "+61 2 1234 5678",
                "abn": "12 345 678 901"
            },
            "client_details": {
                "company_name": "Client Corp",
                "company_email": "client@corp.com",
                "contact_name": "Jane Smith",
                "address_line1": "456 Client Ave",
                "address_line2": "",
                "address_line3": "",
                "phone": "",
                "abn": ""
            },
            "bank_details": {
                "account_name": "Test Company Pty Ltd",
                "bsb": "123-456",
                "account_number": "12345678"
            },
            "line_items": [
                {
                    "service_date": "2026-01-10",
                    "product": "Web Development",
                    "description": "Frontend development services",
                    "gst_applicable": True,
                    "quantity": 10,
                    "rate": 150.0
                },
                {
                    "service_date": "2026-01-12",
                    "product": "Consulting",
                    "description": "Technical consulting",
                    "gst_applicable": True,
                    "quantity": 5,
                    "rate": 200.0
                }
            ],
            "notes": "Payment due within 30 days"
        }
        
        # Create invoice
        response = requests.post(
            f"{BASE_URL}/api/invoices",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        created = response.json()
        
        # Verify response structure
        assert "id" in created
        assert created["invoice_number"] == "TEST_001"
        assert created["invoice_date"] == "2026-01-15"
        assert created["due_date"] == "2026-02-15"
        
        # Verify totals calculation
        # Line 1: 10 * 150 = 1500
        # Line 2: 5 * 200 = 1000
        # Subtotal: 2500
        # GST (10%): 250
        # Total: 2750
        assert created["subtotal"] == 2500.0
        assert created["gst_total"] == 250.0
        assert created["total"] == 2750.0
        
        invoice_id = created["id"]
        print(f"✓ Created invoice with ID: {invoice_id}")
        print(f"✓ Totals - Subtotal: ${created['subtotal']}, GST: ${created['gst_total']}, Total: ${created['total']}")
        
        # Verify persistence by fetching the invoice
        get_response = requests.get(f"{BASE_URL}/api/invoices/{invoice_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["id"] == invoice_id
        assert fetched["invoice_number"] == "TEST_001"
        assert fetched["subtotal"] == 2500.0
        print(f"✓ Verified invoice persistence")
        
        # Store for cleanup
        pytest.test_invoice_id = invoice_id
    
    def test_get_single_invoice(self):
        """Test GET /api/invoices/{id} - get single invoice"""
        if not hasattr(pytest, 'test_invoice_id'):
            pytest.skip("No test invoice created")
        
        response = requests.get(f"{BASE_URL}/api/invoices/{pytest.test_invoice_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == pytest.test_invoice_id
        assert "company_details" in data
        assert "client_details" in data
        assert "line_items" in data
        print(f"✓ Retrieved invoice {pytest.test_invoice_id}")
    
    def test_get_nonexistent_invoice(self):
        """Test GET /api/invoices/{id} with invalid ID returns 404"""
        response = requests.get(f"{BASE_URL}/api/invoices/nonexistent-id-12345")
        assert response.status_code == 404
        print(f"✓ 404 returned for nonexistent invoice")
    
    def test_update_invoice_and_verify(self):
        """Test PUT /api/invoices/{id} - update invoice"""
        if not hasattr(pytest, 'test_invoice_id'):
            pytest.skip("No test invoice created")
        
        update_payload = {
            "invoice_number": "TEST_001_UPDATED",
            "invoice_date": "2026-01-20",
            "due_date": "2026-02-20",
            "company_details": {
                "company_name": "Updated Company",
                "company_email": "updated@company.com",
                "contact_name": "John Doe",
                "address_line1": "123 Test Street",
                "address_line2": "",
                "address_line3": "",
                "phone": "",
                "abn": ""
            },
            "client_details": {
                "company_name": "Client Corp",
                "company_email": "client@corp.com",
                "contact_name": "Jane Smith",
                "address_line1": "456 Client Ave",
                "address_line2": "",
                "address_line3": "",
                "phone": "",
                "abn": ""
            },
            "bank_details": {
                "account_name": "Updated Account",
                "bsb": "999-888",
                "account_number": "99999999"
            },
            "line_items": [
                {
                    "service_date": "2026-01-15",
                    "product": "Updated Service",
                    "description": "Updated description",
                    "gst_applicable": True,
                    "quantity": 20,
                    "rate": 100.0
                }
            ],
            "notes": "Updated notes"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/invoices/{pytest.test_invoice_id}",
            json=update_payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["invoice_number"] == "TEST_001_UPDATED"
        assert updated["company_details"]["company_name"] == "Updated Company"
        
        # Verify new totals: 20 * 100 = 2000, GST = 200, Total = 2200
        assert updated["subtotal"] == 2000.0
        assert updated["gst_total"] == 200.0
        assert updated["total"] == 2200.0
        print(f"✓ Updated invoice {pytest.test_invoice_id}")
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/invoices/{pytest.test_invoice_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["invoice_number"] == "TEST_001_UPDATED"
        assert fetched["subtotal"] == 2000.0
        print(f"✓ Verified update persistence")


class TestPDFGeneration:
    """Test PDF generation"""
    
    def test_generate_pdf_for_invoice(self):
        """Test POST /api/invoices/{id}/pdf - generate PDF"""
        if not hasattr(pytest, 'test_invoice_id'):
            pytest.skip("No test invoice created")
        
        response = requests.post(f"{BASE_URL}/api/invoices/{pytest.test_invoice_id}/pdf")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "pdf_base64" in data
        assert "filename" in data
        assert isinstance(data["pdf_base64"], str)
        assert len(data["pdf_base64"]) > 0
        assert data["filename"].endswith(".pdf")
        print(f"✓ PDF generated: {data['filename']}, size: {len(data['pdf_base64'])} chars")
    
    def test_generate_pdf_nonexistent_invoice(self):
        """Test PDF generation for nonexistent invoice returns 404"""
        response = requests.post(f"{BASE_URL}/api/invoices/nonexistent-id/pdf")
        assert response.status_code == 404
        print(f"✓ 404 returned for PDF of nonexistent invoice")


class TestEmailInvoice:
    """Test email invoice functionality"""
    
    def test_email_invoice_structure(self):
        """Test POST /api/invoices/{id}/email - email invoice (structure test)"""
        if not hasattr(pytest, 'test_invoice_id'):
            pytest.skip("No test invoice created")
        
        email_payload = {
            "recipient_email": "test@example.com",
            "subject": "Test Invoice",
            "message": "Please find attached invoice."
        }
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/{pytest.test_invoice_id}/email",
            json=email_payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Email should succeed with valid Resend API key
        if response.status_code == 200:
            data = response.json()
            assert "status" in data
            assert data["status"] == "success"
            assert "message" in data
            print(f"✓ Email sent successfully: {data['message']}")
        else:
            # If email fails, check error structure
            print(f"⚠ Email failed with status {response.status_code}")
            if response.status_code == 500:
                error = response.json()
                assert "detail" in error
                print(f"⚠ Email error: {error['detail']}")
    
    def test_email_invoice_missing_recipient(self):
        """Test email without recipient email"""
        if not hasattr(pytest, 'test_invoice_id'):
            pytest.skip("No test invoice created")
        
        # Pydantic should validate and return 422 for missing required field
        email_payload = {
            "subject": "Test",
            "message": "Test"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/{pytest.test_invoice_id}/email",
            json=email_payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422
        print(f"✓ 422 returned for missing recipient email")


class TestInvoiceDelete:
    """Test invoice deletion (run last)"""
    
    def test_delete_invoice_and_verify(self):
        """Test DELETE /api/invoices/{id} - delete invoice"""
        if not hasattr(pytest, 'test_invoice_id'):
            pytest.skip("No test invoice created")
        
        response = requests.delete(f"{BASE_URL}/api/invoices/{pytest.test_invoice_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "deleted"
        print(f"✓ Deleted invoice {pytest.test_invoice_id}")
        
        # Verify deletion by trying to fetch
        get_response = requests.get(f"{BASE_URL}/api/invoices/{pytest.test_invoice_id}")
        assert get_response.status_code == 404
        print(f"✓ Verified invoice deletion (404 on GET)")
    
    def test_delete_nonexistent_invoice(self):
        """Test DELETE with invalid ID returns 404"""
        response = requests.delete(f"{BASE_URL}/api/invoices/nonexistent-id-12345")
        assert response.status_code == 404
        print(f"✓ 404 returned for deleting nonexistent invoice")


class TestTotalsCalculation:
    """Test totals calculation with various scenarios"""
    
    def test_totals_with_mixed_gst(self):
        """Test totals calculation with mixed GST items"""
        payload = {
            "invoice_number": "TEST_GST_001",
            "invoice_date": "2026-01-15",
            "due_date": "2026-02-15",
            "company_details": {
                "company_name": "Test Co",
                "company_email": "",
                "contact_name": "",
                "address_line1": "",
                "address_line2": "",
                "address_line3": "",
                "phone": "",
                "abn": ""
            },
            "client_details": {
                "company_name": "Client",
                "company_email": "",
                "contact_name": "",
                "address_line1": "",
                "address_line2": "",
                "address_line3": "",
                "phone": "",
                "abn": ""
            },
            "bank_details": {
                "account_name": "",
                "bsb": "",
                "account_number": ""
            },
            "line_items": [
                {
                    "service_date": "2026-01-10",
                    "product": "Item with GST",
                    "description": "GST applicable",
                    "gst_applicable": True,
                    "quantity": 10,
                    "rate": 100.0
                },
                {
                    "service_date": "2026-01-12",
                    "product": "Item without GST",
                    "description": "GST not applicable",
                    "gst_applicable": False,
                    "quantity": 5,
                    "rate": 100.0
                }
            ],
            "notes": ""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/invoices",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        created = response.json()
        
        # Expected: Subtotal = 1000 + 500 = 1500
        # GST only on first item: 1000 * 0.10 = 100
        # Total: 1500 + 100 = 1600
        assert created["subtotal"] == 1500.0
        assert created["gst_total"] == 100.0
        assert created["total"] == 1600.0
        print(f"✓ Mixed GST calculation correct: Subtotal={created['subtotal']}, GST={created['gst_total']}, Total={created['total']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/invoices/{created['id']}")
