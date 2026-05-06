from fastapi import FastAPI, APIRouter, HTTPException, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional, Literal
import uuid
from datetime import datetime, timezone

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CheckoutStatusResponse,
)


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB connection
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# Stripe
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")

# Fixed product catalog (server-side only — never trust client amounts)
PRODUCTS: dict[str, dict] = {
    "remove_ads": {
        "name": "Remove Ads (Forever)",
        "amount": 2.99,
        "currency": "usd",
        "kind": "entitlement",
    },
    "hint_pack_10": {
        "name": "Hint Pack · 10 Hints",
        "amount": 0.99,
        "currency": "usd",
        "kind": "consumable",
        "credits": 10,
    },
}

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class CheckoutCreateRequest(BaseModel):
    product_id: Literal["remove_ads", "hint_pack_10"]
    origin_url: str  # frontend origin, used to build success/cancel URLs
    user_id: Optional[str] = None  # local device id for entitlement tracking


class CheckoutCreateResponse(BaseModel):
    url: str
    session_id: str


class CheckoutStatusOut(BaseModel):
    session_id: str
    status: str
    payment_status: str
    product_id: str
    granted: bool  # whether the entitlement/credits have been applied
    amount_total: int
    currency: str


class ProductListItem(BaseModel):
    id: str
    name: str
    amount: float
    currency: str
    kind: str


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Arrow Escape API"}


@api_router.get("/products", response_model=list[ProductListItem])
async def list_products():
    return [
        ProductListItem(id=pid, name=p["name"], amount=p["amount"], currency=p["currency"], kind=p["kind"])
        for pid, p in PRODUCTS.items()
    ]


@api_router.post("/checkout/session", response_model=CheckoutCreateResponse)
async def create_checkout(req: CheckoutCreateRequest, http_request: Request):
    if req.product_id not in PRODUCTS:
        raise HTTPException(status_code=400, detail="Unknown product")
    product = PRODUCTS[req.product_id]

    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/store?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/store?cancelled=1"

    metadata = {
        "product_id": req.product_id,
        "user_id": req.user_id or "anon",
        "source": "arrow_escape_app",
    }

    checkout_request = CheckoutSessionRequest(
        amount=float(product["amount"]),
        currency=product["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )

    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)

    # MANDATORY: persist transaction with INITIATED status before returning
    txn = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "product_id": req.product_id,
        "user_id": req.user_id or "anon",
        "amount": float(product["amount"]),
        "currency": product["currency"],
        "status": "initiated",
        "payment_status": "unpaid",
        "granted": False,
        "metadata": metadata,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_transactions.insert_one(txn)

    return CheckoutCreateResponse(url=session.url, session_id=session.session_id)


@api_router.get("/checkout/status/{session_id}", response_model=CheckoutStatusOut)
async def checkout_status(session_id: str, http_request: Request):
    txn = await db.payment_transactions.find_one(
        {"session_id": session_id}, {"_id": 0}
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    granted = bool(txn.get("granted", False))
    new_status = txn.get("status", "initiated")
    new_payment_status = txn.get("payment_status", "unpaid")
    amount_total_cents = int(round(float(txn.get("amount", 0)) * 100))
    currency = txn.get("currency", "usd")

    # Try to refresh from Stripe; if the call fails (test sandbox / network),
    # fall back to the stored DB state so the frontend poll still works.
    try:
        stripe_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        new_status = stripe_status.status
        new_payment_status = stripe_status.payment_status
        amount_total_cents = stripe_status.amount_total
        currency = stripe_status.currency

        # Idempotent: only grant entitlement once
        if not granted and new_payment_status == "paid":
            granted = True

        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "status": new_status,
                    "payment_status": new_payment_status,
                    "granted": granted,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
    except Exception as e:
        # Webhook will still flip the payment_status to paid when Stripe fires it.
        logger.warning("Stripe status fetch failed for %s: %s", session_id, e)

    return CheckoutStatusOut(
        session_id=session_id,
        status=new_status,
        payment_status=new_payment_status,
        product_id=txn["product_id"],
        granted=granted,
        amount_total=amount_total_cents,
        currency=currency,
    )


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    try:
        event = await stripe_checkout.handle_webhook(body, signature)
    except Exception as e:
        logger.exception("Stripe webhook handling failed")
        raise HTTPException(status_code=400, detail=str(e))

    # Idempotent update keyed on session_id
    if event.session_id:
        await db.payment_transactions.update_one(
            {"session_id": event.session_id},
            {
                "$set": {
                    "payment_status": event.payment_status,
                    "granted": event.payment_status == "paid",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
    return {"received": True}


# Legacy endpoints kept for compatibility
@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.dict())
    await db.status_checks.insert_one(status_obj.dict())
    return status_obj


@api_router.get("/status", response_model=list[StatusCheck])
async def get_status_checks():
    items = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    return [StatusCheck(**i) for i in items]


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
