"""Normalize the supplied DTDC workbooks into importable rate data.

This is intentionally a separate, reviewable preparation step. It preserves
the source workbook/sheet/row metadata so an import can be audited later.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "_source_rates"
OUT = ROOT / "prisma" / "rate-data" / "dtdc-rates.json"

CPDP = SOURCE / "CPDP New Ecom Level Rates (wef 16 Jul25) (1).xlsx"
DOMESTIC = SOURCE / "Domestic TS rates VJA (01 Jan _26).xlsx"
MLB = SOURCE / "Reverse pickup Multilocation Business (MLB) TS Rates (w.e.f. 1 Oct 2026) (1).xlsx"

LANES = {
    "CITY": "CITY", "REGION": "REGION", "REGIONAL": "REGION", "ZONE": "ZONE",
    "METRO": "METRO", "ROI- A": "ROI_A", "ROI - A": "ROI_A", "ROI- B": "ROI_B",
    "ROI - B": "ROI_B", "SPL DEST.": "SPECIAL_DESTINATION", "SPECIAL DESTINATION": "SPECIAL_DESTINATION",
    "REST OF INDIA": "ROI", "LOCAL": "LOCAL",
}


def number(value):
    try:
        value = float(value)
        return None if pd.isna(value) else round(value, 4)
    except (TypeError, ValueError):
        return None


def weight_row(label):
    text = str(label).upper().replace("\u00a0", " ")
    if "500 GM" in text and "ADDITIONAL" not in text:
        return 0.0, 0.5, "FLAT"
    if "ADDITIONAL 500" in text:
        return 0.5, 1.0, "ADDITIONAL_500G"
    if "1 KG" in text:
        return 0.5, 1.0, "FLAT_1KG"
    if "UP TO 10 KG" in text:
        return 0.0, 10.0, "PER_KG"
    if "ADDITIONAL PER KG" in text or ">10 KG" in text or ">100 KG" in text:
        return 10.0, 1000.0, "PER_KG"
    if "PER KG" in text:
        return 0.0, 1000.0, "PER_KG"
    match = re.search(r"(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*KG", text)
    if match:
        return float(match.group(1)), float(match.group(2)), "BAND"
    return None


def matrix(key, name, matrix_type, service, level, segment, source_file, sheet, effective, adjustment, rows, **extra):
    return {
        "idKey": key,
        "name": name,
        "matrixType": matrix_type,
        "serviceCode": service,
        "levelCode": level,
        "customerSegment": segment,
        "sourceFile": source_file,
        "sourceSheet": sheet,
        "effectiveFrom": effective,
        "costAdjustmentPercent": adjustment,
        "gstPercent": 18,
        "rows": rows,
        **extra,
    }


def parse_cpdp():
    data = pd.read_excel(CPDP, sheet_name="ECOM", header=None)
    result = []
    level = None
    service = None
    headers = None
    for index, row in data.iterrows():
        label = str(row.iloc[1]).strip() if len(row) > 1 and pd.notna(row.iloc[1]) else ""
        level_match = re.search(r"NEL\s*([0-6])", label.upper())
        if level_match and not label.lower().startswith("ecommerce"):
            level = f"NEL{level_match.group(1)}"
            service = None
            headers = None
            continue
        service_match = re.search(r"\b(7V|7X|7D|7G)\b", label.upper())
        if service_match:
            service = service_match.group(1)
            headers = None
            continue
        if label.lower() == "weight":
            headers = [str(x).strip() for x in row.iloc[2:9]]
            continue
        if not level or not service or headers is None:
            continue
        weight = weight_row(label)
        if not weight:
            continue
        min_kg, max_kg, basis = weight
        rows = []
        for offset, header in enumerate(headers):
            value = number(row.iloc[2 + offset])
            if value is not None and header.upper() in LANES:
                rows.append({
                    "lane": LANES[header.upper()], "minWeightKg": min_kg, "maxWeightKg": max_kg,
                    "weightBasis": basis, "sourceCostPrice": value,
                    "sourceRow": str(index + 1), "metadata": {"sourceLabel": label},
                })
        if rows:
            key = f"cpdp-{level.lower()}-{service.lower()}"
            existing = next((item for item in result if item["idKey"] == key), None)
            if existing is None:
                existing = matrix(key, f"DTDC CPDP {level} {service}", "CPDP_ECOM", service, level, "ECOM", CPDP.name, "ECOM", "2025-07-16", 0, [])
                existing["includesFuelSurcharge"] = True
                existing["includesBookCost"] = True
                existing["codFixedCharge"] = 25
                existing["codPercent"] = 1.2
                existing["rtoPercent"] = 80
                result.append(existing)
            existing["rows"].extend(rows)
    return result


def parse_domestic():
    data = pd.read_excel(DOMESTIC, sheet_name=0, header=None)
    result = []
    groups = [(1, "EXPRESS_A"), (5, "EXPRESS_B"), (9, "EXPRESS_C"), (14, "FREEDOM_EXPRESS")]
    for start, service in groups:
        rows = []
        for index in range(3, len(data)):
            destination = data.iloc[index, 0]
            if pd.isna(destination):
                continue
            destination = str(destination).strip()
            for offset, label in enumerate(("100_GM", "250_GM", "500_GM", "ADDITIONAL_500G")):
                value = number(data.iloc[index, start + offset])
                if value is None:
                    continue
                if label == "100_GM":
                    min_kg, max_kg, basis = 0.0, 0.1, "FLAT"
                elif label == "250_GM":
                    min_kg, max_kg, basis = 0.1, 0.25, "FLAT"
                elif label == "500_GM":
                    min_kg, max_kg, basis = 0.25, 0.5, "FLAT"
                else:
                    min_kg, max_kg, basis = 0.5, 1.0, "ADDITIONAL_500G"
                rows.append({"lane": destination, "minWeightKg": min_kg, "maxWeightKg": max_kg, "weightBasis": basis, "sourceCostPrice": value, "sourceRow": str(index + 1), "metadata": {"sourceColumnGroup": service}})
        result.append(matrix(f"domestic-{service.lower()}", f"DTDC Domestic TS {service}", "DOMESTIC_TS_BASE", service, None, "NON_ECOM", DOMESTIC.name, "Vijayawada & Vizag (01 Jan '26)", "2026-01-01", 55, rows, requiresBaseLocation=True, includesFuelSurcharge=True, fuelSurchargePercent=35))
    return result


def parse_mlb():
    result = []
    workbook = pd.ExcelFile(MLB)
    for sheet in workbook.sheet_names:
        if sheet == "Info":
            continue
        data = pd.read_excel(MLB, sheet_name=sheet, header=None)
        for header_index in range(len(data)):
            header_values = [str(value).strip().upper() for value in data.iloc[header_index].tolist() if pd.notna(value)]
            if "WEIGHT SLAB" not in header_values:
                continue

            title_values = [str(value).strip() for value in data.iloc[max(0, header_index - 2):header_index].stack().tolist() if pd.notna(value)]
            title = " ".join(title_values)
            service = "AIR_CARGO" if "AIR CARGO" in title.upper() else "SURFACE_CARGO" if "SURFACE CARGO" in title.upper() else "EXPRESS"
            rows = []
            for row_index in range(header_index + 1, len(data)):
                weight_label = data.iloc[row_index, 2] if len(data.columns) > 2 else None
                if pd.isna(weight_label) or not str(weight_label).strip():
                    break
                weight = weight_row(str(weight_label))
                if not weight:
                    continue
                for column in range(3, len(data.columns)):
                    header_value = data.iloc[header_index, column]
                    if pd.isna(header_value):
                        continue
                    value = number(data.iloc[row_index, column])
                    if value is None:
                        continue
                    raw_lane = str(header_value).strip().upper()
                    lane = LANES.get(raw_lane, raw_lane.replace(" ", "_"))
                    group_number = ((column - 3) // 5) + 1
                    if group_number > 1:
                        lane = f"{lane}_{group_number}"
                    rows.append({"lane": lane, "minWeightKg": weight[0], "maxWeightKg": weight[1], "weightBasis": weight[2], "sourceCostPrice": value, "sourceRow": str(row_index + 1), "metadata": {"sourceTitle": title, "sourceWeightLabel": str(weight_label), "sourceColumn": column, "sourceLaneGroup": group_number}})
            if rows:
                key = f"mlb-{sheet.lower().replace(' ', '-')}-{service.lower()}-{header_index}"
                result.append(matrix(key, f"DTDC MLB {sheet} {service} {header_index + 1}", "MLB_REVERSE", service, None, "NON_ECOM", MLB.name, sheet, "2026-10-01", 55, rows, includesFuelSurcharge=False, fuelSurchargePercent=36.5, pickupChargePerKg=7, pickupMinimumCharge=35))
    return result


def main():
    for path in (CPDP, DOMESTIC, MLB):
        if not path.exists():
            raise SystemExit(f"Missing source workbook: {path}")
    matrices = parse_cpdp() + parse_domestic() + parse_mlb()
    payload = {"generatedAt": datetime.now(timezone.utc).isoformat(), "matrices": matrices}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Generated {len(matrices)} matrices and {sum(len(item['rows']) for item in matrices)} rate rows: {OUT}")


if __name__ == "__main__":
    main()
