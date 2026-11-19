"""Normalize the Domestic TS workbook into customer-facing schedules.

The workbook repeats internal tariff columns (A/B/C/Freedom variants). Those
are cost-source columns, not services we expose. This script keeps the highest
source value for each destination/weight and publishes only Express, Air Cargo,
and Surface Cargo under Branch and India Post.
"""
from __future__ import annotations

import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "_source_rates" / "Domestic TS rates VJA (01 Jan _26).xlsx"
OUT = ROOT / "prisma" / "rate-data" / "dtdc-rates.json"
NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}


def col_index(ref: str) -> int:
    letters = re.match(r"[A-Z]+", ref or "")
    value = 0
    for char in letters.group(0) if letters else "":
        value = value * 26 + ord(char) - 64
    return value - 1


def number(value):
    try:
        return round(float(value), 4)
    except (TypeError, ValueError):
        return None


def weight_row(label: str):
    text = str(label).upper().replace("\u00a0", " ").strip()
    if "100 GM" in text:
        return 0.0, 0.1, "FLAT"
    if "250 GM" in text:
        return 0.1, 0.25, "FLAT"
    if "500 GM" in text and "ADD" not in text:
        return 0.25, 0.5, "FLAT"
    if "ADD" in text and "500" in text:
        return 0.5, 1.0, "ADDITIONAL_500G"
    if "UPTO 3 KG" in text or "UP TO 3 KG" in text:
        return 0.0, 3.0, "UP_TO_BAND"
    if ">3 KG" in text:
        return 3.0, 1000.0, "PER_KG"
    if "<5 KG" in text:
        return 0.0, 5.0, "UP_TO_BAND"
    if "<10 KG" in text:
        return 5.0, 10.0, "UP_TO_BAND"
    if "<25 KG" in text:
        return 10.0, 25.0, "UP_TO_BAND"
    if "<50 KG" in text:
        return 25.0, 50.0, "UP_TO_BAND"
    if ">50 KG" in text:
        return 50.0, 1000.0, "PER_KG"
    return None


def read_first_sheet():
    with zipfile.ZipFile(SOURCE) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = ["".join(node.text or "" for node in item.iter() if node.tag.endswith("}t")) for item in root.findall("main:si", NS)]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relation_map = {item.attrib["Id"]: item.attrib["Target"] for item in rels}
        sheet = workbook.find("main:sheets/main:sheet", NS)
        target = relation_map[sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
        target = target if target.startswith("xl/") else "xl/" + target.lstrip("/")
        root = ET.fromstring(archive.read(target))
        rows = []
        for row in root.findall("main:sheetData/main:row", NS):
            values = {}
            for cell in row.findall("main:c", NS):
                value = cell.find("main:v", NS)
                text = value.text if value is not None else ""
                if cell.attrib.get("t") == "s" and text:
                    text = shared[int(text)]
                values[col_index(cell.attrib.get("r", ""))] = text
            rows.append(values)
        return sheet.attrib["name"], rows


def make_matrix(service: str, segment: str, sheet: str, rows):
    segment_label = "India Post" if segment == "INDIA_POST" else "Branch"
    return {
        "idKey": f"domestic-{segment.lower()}-{service.lower()}",
        "name": f"DTDC {segment_label} {service.replace('_', ' ').title()}",
        "matrixType": "DOMESTIC_TS_BASE",
        "serviceCode": service,
        "levelCode": None,
        "customerSegment": segment,
        "sourceFile": SOURCE.name,
        "sourceSheet": sheet,
        "effectiveFrom": "2026-01-01",
        "costAdjustmentPercent": 55,
        "gstPercent": 18,
        "requiresBaseLocation": True,
        "baseLocationCode": "VJA",
        "includesFuelSurcharge": True,
        "fuelSurchargePercent": 35,
        "rows": rows,
    }


def main():
    if not SOURCE.exists():
        raise SystemExit(f"Missing workbook: {SOURCE}")
    sheet, data = read_first_sheet()
    found = {}
    current_service = None
    india_post = False
    header_index = None
    for index, row in enumerate(data):
        values = " ".join(str(value).strip() for value in row.values() if str(value).strip())
        upper = values.upper()
        if "INDIA POST SERVICEABLE PINCODE" in upper:
            india_post = True
            continue
        if upper.startswith("EXPRESS"):
            current_service = "EXPRESS"
            header_index = None
            continue
        if upper.startswith("AIR CARGO"):
            current_service = "AIR_CARGO"
            header_index = None
            continue
        if upper.startswith("SURFACE CARGO"):
            current_service = "SURFACE_CARGO"
            header_index = None
            continue
        if current_service and any(str(value).strip().upper() in ("DESTINATION", "DESTINATIONS") for value in row.values()):
            header_index = index
            continue
        if current_service is None or header_index is None:
            continue
        destination = str(row.get(0, "")).strip()
        if not destination:
            current_service = None
            header_index = None
            continue
        key = ("INDIA_POST" if india_post else "BRANCH", current_service)
        bucket = found.setdefault(key, {})
        for column, header in data[header_index].items():
            if column == 0:
                continue
            weight = weight_row(header)
            value = number(row.get(column))
            if not weight or value is None:
                continue
            row_key = (destination, weight[0], weight[1], weight[2])
            existing = bucket.get(row_key)
            if existing is None or value > existing["sourceCostPrice"]:
                bucket[row_key] = {"lane": destination, "minWeightKg": weight[0], "maxWeightKg": weight[1], "weightBasis": weight[2], "sourceCostPrice": value, "sourceRow": str(index + 1), "metadata": {"sourceColumnGroup": "internal tariff variants; highest source cost retained"}}

    matrices = []
    for (segment, service), bucket in found.items():
        matrices.append(make_matrix(service, segment, sheet, sorted(bucket.values(), key=lambda item: (item["lane"], item["minWeightKg"]))))
    payload = json.loads(OUT.read_text(encoding="utf-8"))
    payload["matrices"] = [matrix for matrix in payload["matrices"] if matrix["matrixType"] != "DOMESTIC_TS_BASE"] + matrices
    payload["generatedAt"] = datetime.now(timezone.utc).isoformat()
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Rebuilt {len(matrices)} Domestic schedules and {sum(len(matrix['rows']) for matrix in matrices)} rows")


if __name__ == "__main__":
    main()
