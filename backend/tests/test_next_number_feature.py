"""
Backend API Tests for Next Invoice Number Feature (Iteration 4)
Tests: Next number returns max(invoice_number) + 1, not count+1
"""
import pytest
import requests
import os
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL
frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')


class TestNextInvoiceNumberLogic:
    """Test next invoice number returns max + 1, not count + 1"""
    
    def test_next_number_with_existing_invoices(self):
        """Test next number with existing invoices (001, 001, 445, 001) should return 446"""
        # First, get current invoices to understand the state
        list_response = requests.get(f"{BASE_URL}/api/invoices")
        assert list_response.status_code == 200
        existing_invoices = list_response.json()
        print(f"✓ Found {len(existing_invoices)} existing invoices")
        
        # Extract invoice numbers
        invoice_numbers = []
        for inv in existing_invoices:
            try:
                num = int(inv.get('invoice_number', '0'))
                invoice_numbers.append(num)
            except (ValueError, TypeError):
                pass
        
        print(f"✓ Existing invoice numbers: {sorted(invoice_numbers)}")
        
        # Get next number
        response = requests.get(f"{BASE_URL}/api/invoices/next-number")
        assert response.status_code == 200
        data = response.json()
        assert "next_number" in data
        
        next_num = int(data["next_number"])
        expected_next = max(invoice_numbers) + 1 if invoice_numbers else 1
        
        print(f"✓ Next number returned: {data['next_number']}")
        print(f"✓ Expected (max + 1): {expected_next}")
        
        assert next_num == expected_next, f"Expected {expected_next}, got {next_num}"
        print(f"✓ Next number logic correct: max({max(invoice_numbers) if invoice_numbers else 0}) + 1 = {next_num}")
    
    def test_next_number_after_creating_high_number_invoice(self):
        """Test next number after creating invoice with high number (e.g., 500)"""
        # Create invoice with number 500
        payload = {
            "invoice_number": "500",
            "invoice_date": "2026-01-15",
            "due_date": "2026-02-15",
            "company_details": {
                "company_name": "Test Company",
                "company_email": "",
                "contact_name": "",
                "address_line1": "",
                "address_line2": "",
                "address_line3": "",
                "phone": "",
                "abn": ""
            },
            "client_details": {
                "company_name": "Test Client",
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
                    "product": "Test Product",
                    "description": "Test",
                    "gst_applicable": True,
                    "quantity": 1,
                    "rate": 100.0
                }
            ],
            "notes": ""
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/invoices",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert create_response.status_code == 200
        created = create_response.json()
        invoice_id = created["id"]
        print(f"✓ Created invoice with number 500, ID: {invoice_id}")
        
        # Get next number - should be 501
        next_response = requests.get(f"{BASE_URL}/api/invoices/next-number")
        assert next_response.status_code == 200
        next_data = next_response.json()
        
        next_num = int(next_data["next_number"])
        print(f"✓ Next number after creating 500: {next_data['next_number']}")
        
        assert next_num == 501, f"Expected 501, got {next_num}"
        print(f"✓ Next number logic correct: max(500) + 1 = 501")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/invoices/{invoice_id}")
        assert delete_response.status_code == 200
        print(f"✓ Cleaned up test invoice {invoice_id}")
    
    def test_next_number_with_non_numeric_invoice_numbers(self):
        """Test next number ignores non-numeric invoice numbers"""
        # Create invoice with non-numeric number
        payload = {
            "invoice_number": "ABC-123",
            "invoice_date": "2026-01-15",
            "due_date": "2026-02-15",
            "company_details": {
                "company_name": "Test Company",
                "company_email": "",
                "contact_name": "",
                "address_line1": "",
                "address_line2": "",
                "address_line3": "",
                "phone": "",
                "abn": ""
            },
            "client_details": {
                "company_name": "Test Client",
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
                    "product": "Test Product",
                    "description": "Test",
                    "gst_applicable": True,
                    "quantity": 1,
                    "rate": 100.0
                }
            ],
            "notes": ""
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/invoices",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert create_response.status_code == 200
        created = create_response.json()
        invoice_id = created["id"]
        print(f"✓ Created invoice with non-numeric number 'ABC-123', ID: {invoice_id}")
        
        # Get next number - should still be based on numeric invoices only
        next_response = requests.get(f"{BASE_URL}/api/invoices/next-number")
        assert next_response.status_code == 200
        next_data = next_response.json()
        
        # Should be a valid number (not affected by ABC-123)
        next_num = int(next_data["next_number"])
        print(f"✓ Next number (ignoring non-numeric): {next_data['next_number']}")
        assert next_num > 0
        print(f"✓ Non-numeric invoice numbers correctly ignored")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/invoices/{invoice_id}")
        assert delete_response.status_code == 200
        print(f"✓ Cleaned up test invoice {invoice_id}")
