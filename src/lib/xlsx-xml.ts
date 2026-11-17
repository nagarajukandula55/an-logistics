import { inflateRawSync } from "node:zlib";

type ZipEntry = { name: string; data: Buffer };

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extraLength;
    const compressed = buffer.subarray(start, start + compressedSize);
    const data = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : Buffer.alloc(0);
    entries.push({ name, data });
    offset = start + compressedSize;
  }
  return entries;
}

function xmlText(xml: string): string {
  return xml.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
}

function colIndex(ref: string): number {
  const letters = ref.replace(/\d/g, "").toUpperCase();
  let value = 0;
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
  return value - 1;
}

export function readXlsxRows(buffer: Buffer): string[][] {
  const entries = readZipEntries(buffer);
  const byName = new Map(entries.map((entry) => [entry.name, entry.data.toString("utf8")]));
  const shared = (byName.get("xl/sharedStrings.xml")?.match(/<si[\s\S]*?<\/si>/g) ?? []).map(xmlText);
  const sheetNames = [...byName.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort();
  const rows: string[][] = [];
  for (const sheetName of sheetNames) {
    const xml = byName.get(sheetName) ?? "";
    for (const rowXml of xml.match(/<row\b[\s\S]*?<\/row>/g) ?? []) {
      const cells: string[] = [];
      for (const cellXml of rowXml.match(/<c\b[\s\S]*?<\/c>/g) ?? []) {
        const ref = cellXml.match(/\br="([A-Z]+\d+)"/)?.[1] ?? "A1";
        const index = colIndex(ref);
        const type = cellXml.match(/\bt="([^"]+)"/)?.[1];
        const raw = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? cellXml.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
        const value = type === "s" ? shared[Number(raw)] ?? "" : xmlText(raw);
        cells[index] = value;
      }
      rows.push(cells.map((value) => value ?? ""));
    }
  }
  return rows;
}
