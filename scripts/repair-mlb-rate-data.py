"""Repair MLB rows in the committed normalized rate data from the supplied workbook.

The original importer read the numeric rate column as the destination label. This
standard-library-only repair reads the actual Weight Slab and destination header
cells from the workbook and replaces only MLB matrices in dtdc-rates.json.
"""
from __future__ import annotations

import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "_source_rates" / "Reverse pickup Multilocation Business (MLB) TS Rates (w.e.f. 1 Oct 2026) (1).xlsx"
OUT = ROOT / "prisma" / "rate-data" / "dtdc-rates.json"
NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}

LANES = {"LOCAL": "LOCAL", "REGIONAL": "REGION", "ZONAL": "ZONE", "METRO": "METRO", "REST OF INDIA": "ROI"}


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
        return 0.0, 0.25, "FLAT"
    if "500 GM" in text and "ADD" not in text:
        return 0.25, 0.5, "FLAT"
    if "ADDNL" in text or "ADDITIONAL" in text:
        return 0.5, 1.0, "ADDITIONAL_500G"
    if ">10 KG" in text:
        return 10.0, 1000.0, "PER_KG"
    match = re.search(r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*KG", text)
    if match:
        return float(match.group(1)), float(match.group(2)), "BAND"
    if ">100 KG" in text:
        return 100.0, 1000.0, "PER_KG"
    return None


def read_workbook():
    with zipfile.ZipFile(SOURCE) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("main:si", NS):
                shared.append("".join(node.text or "" for node in item.iter() if node.tag.endswith("}t")))
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relation_map = {item.attrib["Id"]: item.attrib["Target"] for item in rels}
        sheets = []
        for sheet in workbook.findall("main:sheets/main:sheet", NS):
            target = relation_map[sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
            target = target if target.startswith("xl/") else "xl/" + target.lstrip("/")
            sheets.append((sheet.attrib["name"], target))
        for sheet_name, target in sheets:
            root = ET.fromstring(archive.read(target))
            rows = []
            for row in root.findall("main:sheetData/main:row", NS):
                values = {}
                for cell in row.findall("main:c", NS):
                    ref = cell.attrib.get("r", "")
                    value = cell.find("main:v", NS)
                    text = value.text if value is not None else ""
                    if cell.attrib.get("t") == "s" and text:
                        text = shared[int(text)]
                    values[col_index(ref)] = text
                rows.append(values)
            yield sheet_name, rows


def make_matrix(sheet: str, service: str, header_index: int, title: str, rows):
    return {
        "idKey": f"mlb-{sheet.lower().replace(' ', '-')}-{service.lower()}-{header_index}",
        "name": f"DTDC MLB {sheet} {service} {header_index + 1}",
        "matrixType": "MLB_REVERSE",
        "serviceCode": service,
        "levelCode": None,
        "customerSegment": "NON_ECOM",
        "sourceFile": SOURCE.name,
        "sourceSheet": sheet,
        "effectiveFrom": "2026-10-01",
        "costAdjustmentPercent": 55,
        "gstPercent": 18,
        "rows": rows,
        "includesFuelSurcharge": False,
        "fuelSurchargePercent": 36.5,
        "pickupChargePerKg": 7,
        "pickupMinimumCharge": 35,
    }


def main():
    if not SOURCE.exists():
        raise SystemExit(f"Missing workbook: {SOURCE}")
    matrices = []
    for sheet, data in read_workbook():
        if sheet == "Info":
            continue
        for header_index, row in enumerate(data):
            headers = {index: str(value).strip() for index, value in row.items() if value}
            header_kind = "WEIGHT" if any(value.upper() in ("WEIGHT", "WEIGHT SLAB") for value in headers.values()) else "DESTINATION" if any(value.upper() == "DESTINATION" for value in headers.values()) else None
            if not header_kind:
                continue
            title = " ".join(str(value).strip() for previous in data[max(0, header_index - 2):header_index] for value in previous.values() if value)
            upper_title = title.upper()
            service = "AIR_CARGO" if "AIR CARGO" in upper_title else "SURFACE_CARGO" if "SURFACE CARGO" in upper_title else "EXPRESS"
            parsed_rows = []
            if header_kind == "WEIGHT":
                weight_column = next(index for index, value in headers.items() if value.upper() in ("WEIGHT", "WEIGHT SLAB"))
                destination_columns = [(index, value) for index, value in headers.items() if index != weight_column and value.upper() not in ("TS RATES", "RATES")]
                for row_index in range(header_index + 1, len(data)):
                    weight_label = data[row_index].get(weight_column, "")
                    if not str(weight_label).strip():
                        break
                    weight = weight_row(weight_label)
                    if not weight:
                        continue
                    for column, header_value in destination_columns:
                        value = number(data[row_index].get(column))
                        if value is None:
                            continue
                        raw_lane = header_value.upper()
                        lane = LANES.get(raw_lane, raw_lane.replace(" ", "_"))
                        group_number = ((column - min(index for index, _ in destination_columns)) // 5) + 1
                        if group_number > 1:
                            lane = f"{lane}_{group_number}"
                        parsed_rows.append({"lane": lane, "minWeightKg": weight[0], "maxWeightKg": weight[1], "weightBasis": weight[2], "sourceCostPrice": value, "sourceRow": str(row_index + 1), "metadata": {"sourceTitle": title, "sourceWeightLabel": str(weight_label), "sourceColumn": column, "sourceLaneGroup": group_number}})
            else:
                destination_column = next(index for index, value in headers.items() if value.upper() == "DESTINATION")
                weight_columns = [(index, value) for index, value in headers.items() if index > destination_column and weight_row(value)]
                for row_index in range(header_index + 1, len(data)):
                    lane_value = data[row_index].get(destination_column, "")
                    if not str(lane_value).strip():
                        break
                    lane = LANES.get(str(lane_value).strip().upper(), str(lane_value).strip().upper().replace(" ", "_"))
                    for column, weight_label in weight_columns:
                        weight = weight_row(weight_label)
                        value = number(data[row_index].get(column))
                        if not weight or value is None:
                            continue
                        group_number = ((column - weight_columns[0][0]) // 4) + 1
                        group_lane = f"{lane}_{group_number}" if group_number > 1 else lane
                        parsed_rows.append({"lane": group_lane, "minWeightKg": weight[0], "maxWeightKg": weight[1], "weightBasis": weight[2], "sourceCostPrice": value, "sourceRow": str(row_index + 1), "metadata": {"sourceTitle": title, "sourceWeightLabel": str(weight_label), "sourceColumn": column, "sourceLaneGroup": group_number}})
            if parsed_rows:
                matrices.append(make_matrix(sheet, service, header_index, title, parsed_rows))
    payload = json.loads(OUT.read_text(encoding="utf-8"))
    payload["matrices"] = [matrix for matrix in payload["matrices"] if matrix["matrixType"] != "MLB_REVERSE"] + matrices
    payload["generatedAt"] = datetime.now(timezone.utc).isoformat()
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    rows = sum(len(matrix["rows"]) for matrix in matrices)
    numeric_lanes = [row["lane"] for matrix in matrices for row in matrix["rows"] if re.fullmatch(r"\d+(?:\.\d+)?", row["lane"])]
    print(f"Rebuilt {len(matrices)} MLB matrices and {rows} rows; numeric destination labels: {len(numeric_lanes)}")


if __name__ == "__main__":
    main()
