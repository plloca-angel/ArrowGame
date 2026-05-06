"""Backend regression tests for Arrow Escape (products + checkout)."""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- products ---
class TestProducts:
    def test_list_products_returns_two(self, session):
        r = session.get(f"{API}/products", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        ids = {p["id"]: p for p in data}
        assert "remove_ads" in ids and "hint_pack_10" in ids
        assert ids["remove_ads"]["amount"] == 2.99
        assert ids["hint_pack_10"]["amount"] == 0.99
        assert ids["remove_ads"]["currency"] == "usd"
        assert ids["remove_ads"]["kind"] == "entitlement"
        assert ids["hint_pack_10"]["kind"] == "consumable"


# --- checkout session ---
class TestCheckout:
    created_session_id = None

    def test_create_checkout_remove_ads(self, session):
        payload = {
            "product_id": "remove_ads",
            "origin_url": "https://example.com",
            "user_id": "TEST_user",
        }
        r = session.post(f"{API}/checkout/session", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and data["url"].startswith("http")
        assert "session_id" in data and len(data["session_id"]) > 5
        TestCheckout.created_session_id = data["session_id"]

    def test_create_checkout_invalid_product(self, session):
        r = session.post(
            f"{API}/checkout/session",
            json={
                "product_id": "not_a_real_product",
                "origin_url": "https://example.com",
                "user_id": "TEST_user",
            },
            timeout=20,
        )
        # Pydantic Literal validation returns 422; route-level check returns 400
        assert r.status_code in (400, 422), r.text

    def test_status_for_created_session(self, session):
        sid = TestCheckout.created_session_id
        assert sid, "No session created in previous test"
        r = session.get(f"{API}/checkout/status/{sid}", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["session_id"] == sid
        assert data["product_id"] == "remove_ads"
        assert "payment_status" in data
        assert "status" in data
        assert "granted" in data
        # unpaid since we didn't actually pay
        assert data["granted"] is False

    def test_status_non_existent(self, session):
        r = session.get(f"{API}/checkout/status/sess_does_not_exist_TEST", timeout=20)
        assert r.status_code == 404, r.text
