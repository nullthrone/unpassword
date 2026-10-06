#!/usr/bin/env python3
"""Cross-check unpassword's outputs with independent implementations.

    cd web && UNPASSWORD_DUMP=/tmp/up npx vitest run tests/dump.test.ts
    python3 scripts/crosscheck.py /tmp/up

Requires: pip install pikepdf msoffcrypto-tool
"""
import io
import sys
import zipfile
from pathlib import Path

import msoffcrypto
import pikepdf

ROOT = Path(__file__).resolve().parent.parent
PLAIN_ZIP = ROOT / "web" / "tests" / "fixtures" / "zip" / "plain.zip"


def check_pdf(path: Path, mode: str):
    pdf = pikepdf.open(path)  # no password
    if mode == "decrypted":
        assert not pdf.is_encrypted, "still encrypted"
    else:
        assert pdf.is_encrypted, "restrictions were dropped"
        allow = pdf.allow
        assert not allow.extract and not allow.print_highres, f"restrictions lost: {allow}"
    assert len(pdf.pages) == 1


def check_ooxml(path: Path):
    data = path.read_bytes()
    assert not msoffcrypto.OfficeFile(io.BytesIO(data)).is_encrypted(), "still encrypted"
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        assert z.testzip() is None
        assert "[Content_Types].xml" in z.namelist()


def check_zip(path: Path, source: str):
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None
        for info in z.infolist():
            assert not info.flag_bits & 0x1, f"{info.filename} still encrypted"
        if source in ("zipcrypto.zip", "aes.zip"):
            with zipfile.ZipFile(PLAIN_ZIP) as ref:
                for name in ref.namelist():
                    if not name.endswith("/"):
                        assert z.read(name) == ref.read(name), f"{name} differs"


def main(directory: str):
    files = sorted(Path(directory).iterdir())
    if not files:
        raise SystemExit("no outputs found")
    failed = 0
    for f in files:
        # <kind>__<source>.<user|owner>.<mode>
        kind, rest = f.name.split("__", 1)
        source, _which, mode = rest.rsplit(".", 2)
        try:
            if kind == "pdf":
                check_pdf(f, mode)
            elif kind == "office":
                check_ooxml(f)
            else:
                check_zip(f, source)
            print(f"ok    {f.name}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"FAIL  {f.name}: {e}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main(sys.argv[1])
