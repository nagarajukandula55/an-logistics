import json
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

SOURCE = Path("_source_rates/Pincode_TAT_Details_19-11-2026--18-12-13.xlsx")
TARGET = Path("prisma/rate-data/pincode-coverage.json")
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def cell_value(cell, shared_strings):
    value = cell.find("m:v", NS)
    if value is None:
        return ""
    if cell.get("t") == "s":
        return shared_strings[int(value.text)]
    return value.text or ""


def clean(value):
    return " ".join(str(value or "").strip().split())


def normalize_flag(value):
    return clean(value).upper() in {"YES", "Y", "TRUE"}


def main():
    if not SOURCE.exists():
        raise SystemExit(f"Missing source workbook: {SOURCE}")

    with zipfile.ZipFile(SOURCE) as workbook:
        shared_root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
        shared = [clean("".join(t.text or "" for t in item.findall(".//m:t", NS))) for item in shared_root.findall("m:si", NS)]
        sheet = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.findall(".//m:sheetData/m:row", NS):
            rows.append([cell_value(cell, shared) for cell in row.findall("m:c", NS)])

    headers = rows[0]
    expected = ["Pincode", "State", "District", "Pick Up Status", "Delivery Status", "Office Name", "India Post Pincode", "End Mile TAT"]
    if headers != expected:
        raise SystemExit(f"Unexpected headers: {headers}")

    records = []
    for values in rows[1:]:
        values = values + [""] * (len(headers) - len(values))
        pincode = clean(values[0]).zfill(6)
        if len(pincode) != 6 or not pincode.isdigit():
            continue
        tat_text = clean(values[7])
        try:
            tat_days = int(float(tat_text)) if tat_text else None
        except ValueError:
            tat_days = None
        records.append({
            "pincode": pincode,
            "state": clean(values[1]),
            "district": clean(values[2]),
            "pickupStatus": clean(values[3]),
            "deliveryStatus": clean(values[4]),
            "officeName": clean(values[5]),
            "indiaPostAvailable": normalize_flag(values[6]),
            "endMileTatDays": tat_days,
            "latitude": None,
            "longitude": None,
            "coordinatesSource": None,
            "coordinatesUpdatedAt": None,
        })

    records.sort(key=lambda item: item["pincode"])
    state_counts = Counter(item["state"] for item in records)
    district_counts = Counter(item["state"] + "|" + item["district"] for item in records)
    payload = {
        "generatedAt": "2026-11-19",
        "sourceFile": SOURCE.name,
        "headers": expected,
        "recordCount": len(records),
        "states": [{"name": state, "pincodes": count} for state, count in sorted(state_counts.items())],
        "districtCount": len(district_counts),
        "records": records,
    }
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Imported {len(records)} pincode records across {len(state_counts)} states into {TARGET}")


if __name__ == "__main__":
    main()
