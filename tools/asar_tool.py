#!/usr/bin/env python3
"""Read files inside an Electron .asar archive without extracting it.

Usage:
  asar_tool.py grep <asar> <path-regex> <content-regex> [maxhits]
  asar_tool.py cat <asar> <exact-path>
  asar_tool.py ls <asar> <path-regex> [limit]
"""
import json
import re
import sys
import struct

HDR = {}  # path -> (offset, size)


DATA_START = 0


def load(path):
    global DATA_START
    with open(path, "rb") as f:
        head = f.read(8)
        header_size = struct.unpack("<I", head[4:8])[0]
        DATA_START = 8 + header_size
        raw = f.read(header_size)
    # pickle payload: uint32 len, string bytes, padded to 4
    strlen = struct.unpack("<I", raw[4:8])[0]
    js = raw[8:8 + strlen].decode("utf-8")
    tree = json.loads(js)
    out = []

    def walk(node, prefix):
        for name, meta in node.get("files", {}).items():
            p = f"{prefix}/{name}" if prefix else name
            if "files" in meta:
                walk(meta, p)
            else:
                out.append((p, int(meta.get("offset") or -1), int(meta.get("size") or 0)))

    walk(tree, "")
    return out


def read_file(asar, offset, size):
    with open(asar, "rb") as f:
        f.seek(DATA_START + offset)
        return f.read(size)


def main():
    cmd = sys.argv[1]
    asar = sys.argv[2]
    entries = load(asar)
    if cmd == "ls":
        pat = re.compile(sys.argv[3])
        limit = int(sys.argv[4]) if len(sys.argv) > 4 else 200
        n = 0
        for p, off, size in entries:
            if pat.search(p):
                print(f"{size:>9}  {p}")
                n += 1
                if n >= limit:
                    print("... truncated")
                    break
        print(f"[{n} shown of {len(entries)} entries]", file=sys.stderr)
    elif cmd == "cat":
        target = sys.argv[3].lstrip("/")
        for p, off, size in entries:
            if p == target:
                sys.stdout.write(read_file(asar, off, size).decode("utf-8", "replace"))
                return
        print(f"not found: {target}", file=sys.stderr)
        sys.exit(1)
    elif cmd == "grep":
        pathpat = re.compile(sys.argv[3])
        contentpat = re.compile(sys.argv[4])
        maxhits = int(sys.argv[5]) if len(sys.argv) > 5 else 60
        hits = 0
        for p, off, size in entries:
            if off < 0 or size > 6_000_000 or not pathpat.search(p):
                continue
            try:
                text = read_file(asar, off, size).decode("utf-8", "replace")
            except Exception as exc:
                print(f"ERR {p}: {exc}", file=sys.stderr)
                continue
            for i, line in enumerate(text.splitlines(), 1):
                if contentpat.search(line):
                    print(f"{p}:{i}: {line.strip()[:300]}")
                    hits += 1
                    if hits >= maxhits:
                        print("... truncated", file=sys.stderr)
                        return
    else:
        print(__doc__)
        sys.exit(2)


if __name__ == "__main__":
    main()
