"""UK House Price Index (HPI) — scale property purchase prices to today.

Data source: HM Land Registry, https://landregistry.data.gov.uk/data/ukhpi.
The index is published monthly with a ~2-month lag.

Region slugs follow Land Registry conventions: `united-kingdom`, `england`,
`scotland`, `wales`, `london`, `north-west`, `south-east`, `manchester`,
`camden`, `city-of-westminster`, etc. Default is `united-kingdom`.
"""
from __future__ import annotations

import time
from datetime import date, timedelta
from typing import Any

import httpx

API_BASE = "https://landregistry.data.gov.uk/data/ukhpi"
TIMEOUT = 10.0
CACHE_TTL_SECONDS = 6 * 3600

# subtype -> field suffix on the HPI primaryTopic
SUBTYPE_INDEX_KEY: dict[str, str] = {
    "flat": "housePriceIndexFlatMaisonette",
    "maisonette": "housePriceIndexFlatMaisonette",
    "terraced": "housePriceIndexTerraced",
    "semi-detached": "housePriceIndexSemiDetached",
    "semi_detached": "housePriceIndexSemiDetached",
    "detached": "housePriceIndexDetached",
    "new-build": "housePriceIndexNewBuild",
    "new_build": "housePriceIndexNewBuild",
}
DEFAULT_INDEX_KEY = "housePriceIndex"

_cache: dict[tuple[str, str], tuple[float, dict]] = {}


def _cache_get(region: str, ym: str) -> dict | None:
    key = (region, ym)
    hit = _cache.get(key)
    if not hit:
        return None
    when, value = hit
    if time.time() - when > CACHE_TTL_SECONDS:
        _cache.pop(key, None)
        return None
    return value


def _cache_set(region: str, ym: str, value: dict) -> None:
    _cache[(region, ym)] = (time.time(), value)


def _fetch_month(region: str, ym: str) -> dict | None:
    """Return primaryTopic dict for the given region/month, or None if missing."""
    cached = _cache_get(region, ym)
    if cached is not None:
        return cached
    url = f"{API_BASE}/region/{region}/month/{ym}.json"
    try:
        r = httpx.get(url, timeout=TIMEOUT, follow_redirects=True)
    except httpx.HTTPError:
        return None
    if r.status_code != 200:
        return None
    try:
        data = r.json()
    except ValueError:
        return None
    pt = data.get("result", {}).get("primaryTopic")
    if not isinstance(pt, dict):
        return None
    _cache_set(region, ym, pt)
    return pt


def _latest_month_with_data(region: str, today: date | None = None) -> tuple[str, dict] | None:
    """Walk back month-by-month from today until we find HPI data."""
    today = today or date.today()
    cursor = today.replace(day=1)
    for _ in range(8):  # try last 8 months max (HPI lag is ~2 months)
        ym = cursor.strftime("%Y-%m")
        data = _fetch_month(region, ym)
        if data is not None:
            return ym, data
        # step back one month
        prev = cursor - timedelta(days=1)
        cursor = prev.replace(day=1)
    return None


def _index_for_subtype(point: dict, subtype: str | None) -> tuple[str, float] | None:
    """Pick the property-type-specific index when present, else the all-types index."""
    if subtype:
        key = SUBTYPE_INDEX_KEY.get(subtype.lower())
        if key and isinstance(point.get(key), (int, float)):
            return key, float(point[key])
    fallback = point.get(DEFAULT_INDEX_KEY)
    if isinstance(fallback, (int, float)):
        return DEFAULT_INDEX_KEY, float(fallback)
    return None


def _purchase_month(purchase_date: str) -> str:
    """Return YYYY-MM for the purchase month."""
    return purchase_date[:7]


def revalue(prop: dict[str, Any]) -> dict[str, Any] | None:
    """Compute an HPI-scaled current value for a property.

    Returns a dict with `value`, `region`, `subtype_key`, `as_of`, `bought_at`,
    `delta_pct` — or None if HPI data couldn't be fetched.
    """
    purchase_price = prop.get("purchase_price")
    purchase_date = prop.get("purchase_date")
    if not purchase_price or not purchase_date:
        return None

    region = (prop.get("region") or "united-kingdom").strip().lower()
    subtype = prop.get("property_subtype")

    bought_ym = _purchase_month(purchase_date)
    bought = _fetch_month(region, bought_ym)
    if bought is None:
        # Walk forward up to 3 months to find the closest published month at/after purchase
        y, m = int(bought_ym[:4]), int(bought_ym[5:7])
        for _ in range(3):
            m += 1
            if m == 13:
                m = 1
                y += 1
            data = _fetch_month(region, f"{y:04d}-{m:02d}")
            if data is not None:
                bought = data
                bought_ym = f"{y:04d}-{m:02d}"
                break
    if bought is None:
        return None

    latest = _latest_month_with_data(region)
    if latest is None:
        return None
    latest_ym, latest_point = latest

    bought_idx = _index_for_subtype(bought, subtype)
    latest_idx = _index_for_subtype(latest_point, subtype)
    if not bought_idx or not latest_idx:
        return None

    bought_key, bought_value = bought_idx
    latest_key, latest_value = latest_idx
    if bought_value <= 0:
        return None

    factor = latest_value / bought_value
    new_value = round(float(purchase_price) * factor, 2)
    delta_pct = round((factor - 1) * 100, 2)

    return {
        "value": new_value,
        "region": region,
        "subtype_key": latest_key,
        "as_of": latest_ym,
        "bought_at": bought_ym,
        "bought_index": bought_value,
        "latest_index": latest_value,
        "delta_pct": delta_pct,
        "source": "hm-land-registry-ukhpi",
    }
