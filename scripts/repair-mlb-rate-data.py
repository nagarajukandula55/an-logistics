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

LANES = {
    "CITY": "CITY",
    "LOCAL": "LOCAL",
    "REGIONAL": "REGION",
    "REGION": "REGION",
    "ZONAL": "ZONE",
    "ZONE": "ZONE",
    "METRO": "METRO",
    "REST OF INDIA": "ROI",
    "ROI": "ROI",
    "ROI - A": "ROI_A",
    "ROI- A": "ROI_A",
    "ROI - B": "ROI_B",
    "ROI- B": "ROI_B",
    "SPL DEST.": "SPECIAL_DESTINATION",
    "SPECIAL DESTINATION": "SPECIAL_DESTINATION",
}


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
    if "ADDITIONAL PER KG" in text:
        if ">5" in text:
            return 5.0, 1000.0, "PER_KG"
        if ">10" in text:
            return 10.0, 1000.0, "PER_KG"
        return 1.0, 1000.0, "PER_KG"
    if "UPTO 250" in text or "UP TO 250" in text:
        return 0.0, 0.25, "FLAT"
    if "UPTO 500" in text or "UP TO 500" in text:
        return 0.0, 0.5, "FLAT"
    if "ADDL" in text and "500" in text:
        return 0.5, 1.0, "ADDITIONAL_500G"
    if "3-25 KG" in text or "3 - 25 KG" in text:
        return 3.0, 25.0, "BAND"
    if "25.001 - 50" in text:
        return 25.001, 50.0, "BAND"
    if "50.001 - 100" in text:
        return 50.001, 100.0, "BAND"
    if "ABOVE 100" in text:
        return 100.0, 1000.0, "PER_KG"
    if "UPTO 3 KG" in text or "UP TO 3 KG" in text:
        return 0.0, 3.0, "UP_TO_BAND"
    if ">3 KG" in text:
        return 3.0, 1000.0, "PER_KG"
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
    if "UP TO 10 KG" in text or "UPTO 10 KG" in text:
        return 0.0, 10.0, "PER_KG"
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
    if ">5 KG" in text:
        return 5.0, 1000.0, "PER_KG"
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


def make_matrix(sheet: str, service: str, header_index: int, title: str, rows, segment="NON_ECOM"):
    short_title = " ".join(str(title).split())[:120] or sheet
    short_title = re.sub(r"\s*\(FSC[^)]*\)", "", short_title, flags=re.IGNORECASE)
    short_title = re.sub(r"\s*W\.E\.F\..*", "", short_title, flags=re.IGNORECASE)
    short_title = re.sub(r"\s*wef:.*", "", short_title, flags=re.IGNORECASE)
    short_title = re.sub(r"\s*Rs\.\s*.*", "", short_title, flags=re.IGNORECASE)
    short_title = re.sub(r"\s+", " ", short_title).strip(" -")
    segment_label = {"B2C_ECOM_DTDC": "B2C E-commerce DTDC", "B2C_ECOM_INDIA_POST": "B2C E-commerce India Post", "DTDC": "DTDC", "INDIA_POST": "India Post", "DOX": "Priority Dox", "NON_DOX": "Priority Non-dox", "MLB": "MLB"}.get(segment, "MLB")
    if segment in ("DOX", "NON_DOX"):
        short_title = ""
    return {
        "idKey": f"mlb-{sheet.lower().replace(' ', '-')}-{service.lower()}-{header_index}",
        "name": f"MLB {'' if segment == 'NON_ECOM' else segment_label + ' '}{short_title}".strip(),
        "matrixType": "MLB_REVERSE",
        "serviceCode": service,
        "levelCode": None,
        "customerSegment": segment,
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


def parse_bp_bs(data, sheet):
    matrices = []
    india_post = False
    blue_scope = False
    current_service = None
    service_title = ""
    for index, row in enumerate(data):
        text = " ".join(str(value).strip() for value in row.values() if str(value).strip())
        upper = text.upper()
        if "INDIA POST SERVICEABLE PINCODE" in upper:
            india_post = True
            blue_scope = False
            current_service = None
            continue
        if "ECOMMERCE MULTILOCATION FORWARD TS RATES" in upper:
            blue_scope = "BLUE CPS" in upper
            current_service = None
            continue
        if "ECOMMERCE" in upper and re.search(r"\b7[VDXG]\b", upper):
            match = re.search(r"\b(7V|7X|7D|7G)\b", upper)
            current_service = match.group(1) if match else None
            service_title = text
            if india_post:
                blue_scope = "BLUE CPS" in upper
            continue
        if not current_service or not blue_scope:
            continue
        headers = {column: str(value).strip() for column, value in row.items() if str(value).strip()}
        if not any(value.upper() == "WEIGHT" for value in headers.values()):
            continue
        weight_column = next(column for column, value in headers.items() if value.upper() == "WEIGHT")
        lane_columns = [(column, value) for column, value in headers.items() if column > weight_column]
        parsed_rows = []
        for row_index in range(index + 1, len(data)):
            weight_label = str(data[row_index].get(weight_column, "")).strip()
            if not weight_label:
                break
            weight = weight_row(weight_label)
            if not weight:
                continue
            for column, lane_value in lane_columns:
                value = number(data[row_index].get(column))
                if value is None:
                    continue
                raw_lane = lane_value.upper().replace(".", "").strip()
                parsed_rows.append({"lane": LANES.get(raw_lane, raw_lane.replace(" ", "_")), "minWeightKg": weight[0], "maxWeightKg": weight[1], "weightBasis": weight[2], "sourceCostPrice": value, "sourceRow": str(row_index + 1), "metadata": {"sourceTitle": service_title, "sourceWeightLabel": weight_label, "sourceColumn": column}})
        if parsed_rows:
            segment = "B2C_ECOM_INDIA_POST" if india_post else "B2C_ECOM_DTDC"
            matrices.append(make_matrix(sheet, current_service, index, current_service, parsed_rows, segment))
            current_service = None
    return matrices


def parse_regional_sheet(data, sheet):
    """Parse zonal/RO sheets as explicit service sections."""
    matrices = []
    segment = "DTDC"
    service = None
    zone_title = {"NZ (except SN) Zonal Reverse TS": "North Zone", "Srinagar Zonal Reverse TS": "Jammu & Srinagar", "WZ Zonal Reverse TS": "West Zone", "SZ Zonal Reverse TS": "South Zone", "EZ Zonal Reverse TS": "East Zone", "GAU Reverse TS": "Guwahati"}.get(sheet, sheet)
    for index, row in enumerate(data):
        values = [str(value).strip() for value in row.values() if str(value).strip()]
        text = " ".join(values)
        upper = text.upper()
        if "INDIA POST SERVICEABLE PINCODE" in upper:
            segment = "INDIA_POST"
            service = None
            continue
        if upper.startswith("EXPRESS"):
            service = "EXPRESS"
        elif upper.startswith("AIR CARGO"):
            service = "AIR_CARGO"
        elif upper.startswith("SURFACE CARGO"):
            service = "SURFACE_CARGO"
        if not service or not any(str(value).strip().upper() in ("DESTINATION", "DESTINATIONS") for value in row.values()):
            continue
        weight_columns = [(column, value) for column, value in row.items() if column > 0 and weight_row(value)]
        if not weight_columns:
            continue
        values_by_key = {}
        for row_index in range(index + 1, len(data)):
            lane_value = str(data[row_index].get(0, "")).strip()
            if not lane_value:
                break
            for column, weight_label in weight_columns:
                weight = weight_row(weight_label)
                value = number(data[row_index].get(column))
                if not weight or value is None:
                    continue
                lane_text = lane_value.upper().replace(".", "").strip()
                lane = LANES.get(lane_text, lane_text.replace(" ", "_"))
                key = (lane, weight[0], weight[1], weight[2])
                existing = values_by_key.get(key)
                if existing is None or value > existing["sourceCostPrice"]:
                    values_by_key[key] = {"lane": lane, "minWeightKg": weight[0], "maxWeightKg": weight[1], "weightBasis": weight[2], "sourceCostPrice": value, "sourceRow": str(row_index + 1), "metadata": {"sourceTitle": text, "sourceWeightLabel": str(weight_label), "sourceColumn": column}}
        if values_by_key:
            service_label = {"EXPRESS": "Express", "AIR_CARGO": "Air Cargo", "SURFACE_CARGO": "Surface Cargo"}[service]
            segment_label = "India Post" if segment == "INDIA_POST" else "DTDC"
            rows = sorted(values_by_key.values(), key=lambda item: (item["lane"], item["minWeightKg"]))
            matrices.append(make_matrix(sheet, service, index, f"{zone_title} {service_label}", rows, segment))
    return matrices


def main():
    if not SOURCE.exists():
        raise SystemExit(f"Missing workbook: {SOURCE}")
    matrices = []
    for sheet, data in read_workbook():
        if sheet == "Info":
            continue
        if sheet == "BP & BS Reverse TS":
            matrices.extend(parse_bp_bs(data, sheet))
            continue
        if sheet != "EP Reverse TS Rates":
            matrices.extend(parse_regional_sheet(data, sheet))
            continue
        india_post = False
        if sheet == "EP Reverse TS Rates":
            # This sheet has explicit Dox and Non-dox sections without a
            # conventional Weight/Weight Slab header.
            for section_index, section in enumerate(data):
                section_label = str(section.get(1, "")).strip().upper()
                if section_label not in ("DOX", "NON-DOX", "NON DOX"):
                    continue
                weight_columns = [(index, value) for index, value in section.items() if index > 1 and weight_row(value)]
                parsed_rows = []
                for row_index in range(section_index + 1, len(data)):
                    lane_value = str(data[row_index].get(1, "")).strip()
                    if not lane_value:
                        break
                    for column, weight_label in weight_columns:
                        weight = weight_row(weight_label)
                        value = number(data[row_index].get(column))
                        if not weight or value is None:
                            continue
                        parsed_rows.append({
                            "lane": LANES.get(lane_value.upper(), lane_value.upper().replace(" ", "_")),
                            "minWeightKg": weight[0],
                            "maxWeightKg": weight[1],
                            "weightBasis": weight[2],
                            "sourceCostPrice": value,
                            "sourceRow": str(row_index + 1),
                            "metadata": {
                                "sourceTitle": "PRIORITY Multilocation Forward TS Rates",
                                "sourceWeightLabel": str(weight_label),
                                "sourceColumn": column,
                            },
                        })
                if parsed_rows:
                    segment = "DOX" if section_label == "DOX" else "NON_DOX"
                    matrices.append(make_matrix(sheet, "PRIORITY", section_index, "PRIORITY", parsed_rows, segment))
        for header_index, row in enumerate(data):
            headers = {index: str(value).strip() for index, value in row.items() if value}
            row_text = " ".join(headers.values()).upper()
            if "INDIA POST SERVICEABLE PINCODE" in row_text:
                india_post = True
                continue
            header_kind = "WEIGHT" if any(value.upper() in ("WEIGHT", "WEIGHT SLAB") for value in headers.values()) else "DESTINATION" if any(value.upper() == "DESTINATION" for value in headers.values()) else None
            if not header_kind:
                continue
            if sheet == "EP Reverse TS Rates" and header_kind == "WEIGHT":
                weight_column = next(index for index, value in headers.items() if value.upper() in ("WEIGHT", "WEIGHT SLAB"))
                destination_columns = [(index, value) for index, value in headers.items() if index != weight_column and value.upper() not in ("TS RATES", "RATES")]
                first_destination = min(index for index, _ in destination_columns)
                group_width = 5
                for group_number, group_start in enumerate(range(first_destination, max(index for index, _ in destination_columns) + 1, group_width)):
                    # Only Blue CP rates are in scope. Green and Gold groups
                    # are present in the workbook but must not be imported.
                    if group_number != 0:
                        continue
                    group_columns = [(index, value) for index, value in destination_columns if group_start <= index < group_start + group_width]
                    if not group_columns:
                        continue
                    group_title = str(data[header_index - 1].get(group_start, "")).strip() if header_index > 0 else ""
                    upper_group_title = group_title.upper()
                    base_service = "PEP" if "PEP" in upper_group_title else "PEC" if "PEC" in upper_group_title else "PRIORITY" if "PRIORITY" in upper_group_title else "EXPRESS"
                    service = f"{base_service}_BLUE"
                    parsed_rows = []
                    for row_index in range(header_index + 1, len(data)):
                        weight_label = data[row_index].get(weight_column, "")
                        if not str(weight_label).strip():
                            break
                        weight = weight_row(weight_label)
                        if not weight:
                            continue
                        for column, header_value in group_columns:
                            value = number(data[row_index].get(column))
                            if value is None:
                                continue
                            raw_lane = header_value.upper()
                            parsed_rows.append({"lane": LANES.get(raw_lane, raw_lane.replace(" ", "_")), "minWeightKg": weight[0], "maxWeightKg": weight[1], "weightBasis": weight[2], "sourceCostPrice": value, "sourceRow": str(row_index + 1), "metadata": {"sourceTitle": group_title, "sourceWeightLabel": str(weight_label), "sourceColumn": column}})
                    if parsed_rows:
                        matrices.append(make_matrix(sheet, service, header_index * 10 + group_start, f"{base_service} Blue CP", parsed_rows))
                continue
            title = " ".join(str(value).strip() for previous in data[max(0, header_index - 8):header_index] for value in previous.values() if value)
            upper_title = title.upper()
            if "GREEN CP" in upper_title or "GOLD CP" in upper_title:
                continue
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
                matrices.append(make_matrix(sheet, service, header_index, title, parsed_rows, "INDIA_POST" if india_post else "DTDC"))
    payload = json.loads(OUT.read_text(encoding="utf-8"))
    payload["matrices"] = [matrix for matrix in payload["matrices"] if matrix["matrixType"] != "MLB_REVERSE"] + matrices
    payload["generatedAt"] = datetime.now(timezone.utc).isoformat()
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    rows = sum(len(matrix["rows"]) for matrix in matrices)
    numeric_lanes = [row["lane"] for matrix in matrices for row in matrix["rows"] if re.fullmatch(r"\d+(?:\.\d+)?", row["lane"])]
    print(f"Rebuilt {len(matrices)} MLB matrices and {rows} rows; numeric destination labels: {len(numeric_lanes)}")


if __name__ == "__main__":
    main()
