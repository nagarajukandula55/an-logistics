"""Merge official OGD India pincode coordinates into the local coverage master.

The source is the Department of Posts dataset exposed through data.gov.in.
The API key and resource id are deliberately supplied as GitHub secrets; no
secret is committed to the repository. Existing coordinates are never replaced
by a scheduled run unless --replace-existing is explicitly used locally.
"""

import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

TARGET = Path("prisma/rate-data/pincode-coverage.json")
DEFAULT_API = "https://api.data.gov.in/resource/"


def key_name(record, names):
    normalized = {str(key).lower().replace("_", "").replace(" ", ""): key for key in record}
    for name in names:
        if name in normalized:
            return normalized[name]
    return None


def number(value):
    try:
        parsed = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    return parsed if -90 <= parsed <= 90 else None


def longitude(value):
    try:
        parsed = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    return parsed if -180 <= parsed <= 180 else None


def read_source():
    direct_url = os.environ.get("PINCODE_GEO_SOURCE_URL", "").strip()
    if direct_url:
        url = direct_url
    else:
        api_key = os.environ.get("PINCODE_DATA_GOV_API_KEY", "").strip()
        resource_id = os.environ.get("PINCODE_DATA_GOV_RESOURCE_ID", "").strip()
        if not api_key or not resource_id:
            raise SystemExit("Set PINCODE_DATA_GOV_API_KEY and PINCODE_DATA_GOV_RESOURCE_ID GitHub secrets, or PINCODE_GEO_SOURCE_URL.")
        query = urllib.parse.urlencode({"api-key": api_key, "format": "json", "limit": 100000})
        url = f"{DEFAULT_API}{resource_id}?{query}"

    request = urllib.request.Request(url, headers={"User-Agent": "AN-Logistics-pincode-refresh/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if isinstance(payload, dict) and isinstance(payload.get("records"), list):
        return payload["records"]
    if isinstance(payload, list):
        return payload
    raise SystemExit("The official pincode source did not return a records array.")


def main():
    if not TARGET.exists():
        raise SystemExit(f"Missing local coverage master: {TARGET}")
    data = json.loads(TARGET.read_text(encoding="utf-8"))
    records = data.get("records", [])
    source_records = read_source()
    coordinates = {}
    directory = {}
    for record in source_records:
        if not isinstance(record, dict):
            continue
        pin_key = key_name(record, {"pincode", "pincodecode", "pincode"})
        lat_key = key_name(record, {"latitude", "lat"})
        lon_key = key_name(record, {"longitude", "long", "lon"})
        if not pin_key or not lat_key or not lon_key:
            continue
        pincode = str(record[pin_key]).strip().split(".")[0].zfill(6)
        if len(pincode) == 6 and pincode.isdigit():
            state_key = key_name(record, {"state", "statename"})
            district_key = key_name(record, {"district", "districtname"})
            office_key = key_name(record, {"officename", "office"})
            delivery_key = key_name(record, {"delivery", "deliverystatus"})
            directory[pincode] = {
                "state": str(record.get(state_key, "")).strip() if state_key else "",
                "district": str(record.get(district_key, "")).strip() if district_key else "",
                "officeName": str(record.get(office_key, "")).strip() if office_key else "",
                "deliveryStatus": str(record.get(delivery_key, "")).strip() if delivery_key else "",
            }
        lat = number(record[lat_key]) if lat_key else None
        lon = longitude(record[lon_key]) if lon_key else None
        if len(pincode) == 6 and pincode.isdigit() and lat is not None and lon is not None:
            coordinates[pincode] = {"latitude": lat, "longitude": lon}

    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    changed = 0
    directory_changed = 0
    for record in records:
        postal = directory.get(record.get("pincode"))
        if postal:
            record_directory_changed = False
            for field in ("state", "district", "officeName", "deliveryStatus"):
                if postal[field] and postal[field] != record.get(field):
                    record[field] = postal[field]
                    directory_changed += 1
                    record_directory_changed = True
            if record_directory_changed:
                record["directorySource"] = "Department of Posts via data.gov.in"
                record["directoryUpdatedAt"] = now
        coordinate = coordinates.get(record.get("pincode"))
        if not coordinate or (record.get("latitude") is not None and record.get("longitude") is not None):
            continue
        record.update(coordinate)
        record["coordinatesSource"] = "Department of Posts via data.gov.in"
        record["coordinatesUpdatedAt"] = now
        changed += 1

    if changed or directory_changed:
        data["directorySource"] = "Department of Posts via data.gov.in"
        data["directoryLastCheckedAt"] = now
    if changed:
        data["coordinatesSource"] = "Department of Posts via data.gov.in"
        data["coordinatesLastCheckedAt"] = now
        TARGET.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Official directory records: {len(directory)}; coordinate records: {len(coordinates)}; changed directory fields: {directory_changed}; added coordinates: {changed}.")


if __name__ == "__main__":
    main()
