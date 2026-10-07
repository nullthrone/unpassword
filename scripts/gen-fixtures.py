#!/usr/bin/env python3
"""Generate the encrypted test fixtures used by web/tests.

Requirements: pip install pikepdf msoffcrypto-tool pyzipper, and the `zip` CLI
(ZipCrypto archives). Run from the repository root:

    python3 scripts/gen-fixtures.py

Every password used here is listed in web/tests/fixtures/README.md. The files
are small and committed so the JS test suite runs without Python; this script
documents and reproduces how they were made. Encryption uses random salts, so
regenerated files differ byte-wise while remaining equivalent.
"""
import io
import re
import shutil
import subprocess
import tempfile
import zipfile
import zlib
from pathlib import Path

import msoffcrypto
from msoffcrypto.format.ooxml import OOXMLFile
import pikepdf
import pyzipper

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "tests" / "fixtures"

USER_PW = "user-Pässwort1"
OWNER_PW = "owner-Pässwort2"
OFFICE_PW = "Büro-Geheim 42"
ZIP_PW = "zip-Geheim3"
ZIP_PW_OTHER = "something-else"

FIXED_DATE = (2024, 1, 2, 3, 4, 6)


def pdf_doc() -> pikepdf.Pdf:
    pdf = pikepdf.new()
    pdf.add_blank_page(page_size=(200, 200))
    content = b"BT /F1 24 Tf 20 100 Td (unpassword test) Tj ET"
    page = pdf.pages[0]
    page.obj.Resources = pikepdf.Dictionary(
        Font=pikepdf.Dictionary(
            F1=pikepdf.Dictionary(Type=pikepdf.Name.Font, Subtype=pikepdf.Name.Type1, BaseFont=pikepdf.Name.Helvetica)
        )
    )
    page.obj.Contents = pdf.make_stream(content)
    pdf.docinfo["/Title"] = "unpassword fixture"
    return pdf


def save_pdf(name: str, **enc):
    pdf = pdf_doc()
    kwargs = {"static_id": True, "deterministic_id": False}
    if enc:
        kwargs["encryption"] = pikepdf.Encryption(**enc)
    pdf.save(OUT / "pdf" / name, **kwargs)


ALLOW_ALL = pikepdf.Permissions(
    accessibility=True,
    extract=True,
    modify_annotation=True,
    modify_assembly=True,
    modify_form=True,
    modify_other=True,
    print_lowres=True,
    print_highres=True,
)
RESTRICTED = pikepdf.Permissions(extract=False, print_highres=False, modify_other=False, modify_assembly=False)
# as Acrobat writes it with "text access for screen readers" unchecked
RESTRICTED_NO_ACCESS = pikepdf.Permissions(
    accessibility=False, extract=False, print_highres=False, modify_other=False, modify_assembly=False
)


def gen_pdf():
    (OUT / "pdf").mkdir(parents=True, exist_ok=True)
    save_pdf("plain.pdf")
    # open password, no restrictions
    save_pdf("user-aes256.pdf", user=USER_PW, owner=OWNER_PW, R=6, allow=ALLOW_ALL)
    # open password plus restrictions, three cipher generations
    save_pdf("restricted-aes256.pdf", user=USER_PW, owner=OWNER_PW, R=6, allow=RESTRICTED)
    save_pdf("restricted-aes128.pdf", user=USER_PW, owner=OWNER_PW, R=4, aes=True, allow=RESTRICTED)
    save_pdf("restricted-rc4.pdf", user=USER_PW, owner=OWNER_PW, R=3, aes=False, metadata=False, allow=RESTRICTED)
    # accessibility denied: only R2/R3 can express it, AES-256 cannot
    save_pdf(
        "restricted-rc4-noaccess.pdf",
        user=USER_PW,
        owner=OWNER_PW,
        R=3,
        aes=False,
        metadata=False,
        allow=RESTRICTED_NO_ACCESS,
    )
    save_pdf("restricted-rc4-40.pdf", user=USER_PW, owner=OWNER_PW, R=2, aes=False, metadata=False, allow=RESTRICTED)
    # no open password, only owner restrictions
    save_pdf("owner-only.pdf", user="", owner=OWNER_PW, R=6, allow=RESTRICTED)
    save_unencrypted_stream_pdf("unencrypted-stream-aes256.pdf")


def save_unencrypted_stream_pdf(name: str):
    """AES-256 file in which one small font stream (a /CIDSet) was left unencrypted.

    Some producers write files like this. Decrypting such a stream yields bytes that
    no longer inflate, which must not abort the whole unlock.
    """
    pdf = pdf_doc()
    # stored deflate, 23 bytes: longer than one AES block, like the streams seen in the wild
    plain = zlib.compress(b"\xff" * 12, 0)
    descriptor = pdf.make_indirect(
        pikepdf.Dictionary(
            Type=pikepdf.Name.FontDescriptor,
            FontName=pikepdf.Name.Helvetica,
            CIDSet=pdf.make_stream(plain, Filter=pikepdf.Name.FlateDecode),
        )
    )
    pdf.pages[0].obj.Resources.Font.F1.FontDescriptor = descriptor
    path = OUT / "pdf" / name
    pdf.save(
        path,
        static_id=True,
        deterministic_id=False,
        object_stream_mode=pikepdf.ObjectStreamMode.disable,
        encryption=pikepdf.Encryption(user=USER_PW, owner=OWNER_PW, R=6, allow=RESTRICTED),
    )
    with pikepdf.open(path, password=USER_PW) as enc:
        num = enc.pages[0].obj.Resources.Font.F1.FontDescriptor.CIDSet.objgen[0]

    # Put the plaintext back in place of the encrypted stream data, then rebuild the xref.
    data = path.read_bytes()
    obj = re.compile(rb"(?m)^%d 0 obj\b.*?/Length (\d+).*?stream\r?\n" % num, re.S).search(data)
    start = obj.end()
    end = start + int(obj.group(1))
    # The filter as a one-element array, as the producer wrote it: qpdf then does not
    # recognise the stream as already compressed and tries to inflate it.
    head = data[: obj.start(1)] + str(len(plain)).encode() + data[obj.end(1) : start]
    head = head[: obj.start()] + head[obj.start() :].replace(b"/Filter /FlateDecode", b"/Filter [ /FlateDecode ]")
    data = head + plain + data[end:]
    body = data[: data.rindex(b"\nxref\n") + 1]
    offsets = {int(m.group(1)): m.start() for m in re.finditer(rb"(?m)^(\d+) 0 obj\b", body)}
    size = max(offsets) + 1
    xref = b"xref\n0 %d\n0000000000 65535 f \n" % size
    xref += b"".join(b"%010d 00000 n \n" % offsets[i] for i in range(1, size))
    trailer = data[data.index(b"trailer", len(body)) : data.rindex(b"startxref")]
    path.write_bytes(body + xref + trailer + b"startxref\n%d\n%%%%EOF\n" % len(body))


def minimal_docx() -> bytes:
    files = {
        "[Content_Types].xml": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            "</Types>"
        ),
        "_rels/.rels": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
            'Target="word/document.xml"/></Relationships>'
        ),
        "word/document.xml": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            "<w:body><w:p><w:r><w:t>unpassword test</w:t></w:r></w:p>"
            + "<w:p><w:r><w:t>Lorem ipsum dolor sit amet.</w:t></w:r></w:p>" * 120
            + "</w:body></w:document>"
        ),
    }
    buf = io.BytesIO()
    # Stored, not deflated: msoffcrypto-tool's OLE writer corrupts streams that
    # land in the mini stream (< 4096 bytes), so the package must be larger.
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
        for name, text in files.items():
            z.writestr(zipfile.ZipInfo(name, FIXED_DATE), text)
    data = buf.getvalue()
    assert len(data) > 4096
    return data


def gen_office():
    (OUT / "office").mkdir(parents=True, exist_ok=True)
    plain = minimal_docx()
    (OUT / "office" / "plain.docx").write_bytes(plain)
    out = io.BytesIO()
    OOXMLFile(io.BytesIO(plain)).encrypt(OFFICE_PW, out)
    (OUT / "office" / "agile.docx").write_bytes(out.getvalue())
    check = msoffcrypto.OfficeFile(io.BytesIO(out.getvalue()))
    check.load_key(password=OFFICE_PW)
    decrypted = io.BytesIO()
    check.decrypt(decrypted, verify_integrity=True)
    assert decrypted.getvalue() == plain
    # Files produced by Microsoft Office itself, and ECMA-376 Standard
    # encryption (which msoffcrypto-tool cannot produce), come from the
    # msoffcrypto-tool test suite (MIT licence, password "Password1234_"):
    #   office/standard.docx     <- tests/inputs/ecma376standard_password.docx
    #   office/office-agile.docx <- tests/inputs/example_password.docx
    #   office/office-agile.xlsx <- tests/inputs/example_password.xlsx


def aes_info(z, name):
    info = z.zipinfo_cls(name, FIXED_DATE)
    info.compress_type = pyzipper.ZIP_DEFLATED
    return info


def gen_zip():
    d = OUT / "zip"
    d.mkdir(parents=True, exist_ok=True)
    payload = {
        "readme.txt": b"unpassword test archive\n" * 20,
        "docs/statement.txt": "Kontoauszug – Umlaute äöü\n".encode() * 50,
    }
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        for name, data in payload.items():
            p = t / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
        for f in ["zipcrypto.zip", "plain.zip"]:
            (d / f).unlink(missing_ok=True)
        subprocess.run(["zip", "-q", "-X", "-r", "-P", ZIP_PW, str(d / "zipcrypto.zip"), "readme.txt", "docs"], cwd=t, check=True)
        subprocess.run(["zip", "-q", "-X", "-r", str(d / "plain.zip"), "readme.txt", "docs"], cwd=t, check=True)

    with pyzipper.AESZipFile(d / "aes.zip", "w", compression=pyzipper.ZIP_DEFLATED, encryption=pyzipper.WZ_AES) as z:
        z.setpassword(ZIP_PW.encode())
        for name, data in payload.items():
            z.writestr(aes_info(z, name), data)

    # two entries encrypted with different passwords: must be rejected
    with pyzipper.AESZipFile(d / "mixed.zip", "w", compression=pyzipper.ZIP_DEFLATED, encryption=pyzipper.WZ_AES) as z:
        z.setpassword(ZIP_PW.encode())
        z.writestr(aes_info(z, "a.txt"), b"first")
        z.setpassword(ZIP_PW_OTHER.encode())
        z.writestr(aes_info(z, "b.txt"), b"second")

    # one encrypted entry next to an unencrypted one: allowed
    buf = io.BytesIO()
    with pyzipper.AESZipFile(buf, "w", compression=pyzipper.ZIP_DEFLATED) as z:
        z.writestr(aes_info(z, "public.txt"), b"not secret")
    with pyzipper.AESZipFile(buf, "a", compression=pyzipper.ZIP_DEFLATED, encryption=pyzipper.WZ_AES) as z:
        z.setpassword(ZIP_PW.encode())
        z.writestr(aes_info(z, "secret.txt"), b"secret")
    (d / "partial.zip").write_bytes(buf.getvalue())


def main():
    if not shutil.which("zip"):
        raise SystemExit("the `zip` CLI is required for ZipCrypto fixtures")
    gen_pdf()
    gen_office()
    gen_zip()
    print(f"fixtures written to {OUT}")


if __name__ == "__main__":
    main()
