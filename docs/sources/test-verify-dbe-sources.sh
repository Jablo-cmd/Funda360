#!/usr/bin/env bash
# Deterministic tests for verify-dbe-sources.sh. No internet: everything is served from a throwaway local server
# (python3) or file:// URLs. Run:  docs/sources/test-verify-dbe-sources.sh
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="$here/verify-dbe-sources.sh"
work="$(mktemp -d)"
server_pid=""
cleanup() { [ -n "$server_pid" ] && kill "$server_pid" 2>/dev/null; rm -rf "$work"; }
trap cleanup EXIT

# Fixture files. a and b have equal bytes; c has different bytes but the same declared title (a title is not evidence).
printf '%%PDF-1.4\n1 0 obj << /Title (CAPS Mathematics Grades 4-6) >> endobj\nsame bytes\n' > "$work/a.pdf"
cp "$work/a.pdf" "$work/b.pdf"
printf '%%PDF-1.4\n1 0 obj << /Title (CAPS Mathematics Grades 4-6) >> endobj\nDIFFERENT bytes\n' > "$work/c.pdf"
# d has exactly the same size as a but different bytes: equal size is not evidence either
printf '%%PDF-1.4\n1 0 obj << /Title (CAPS Mathematics Grades 4-6) >> endobj\nSAME BYTES\n' > "$work/d.pdf"
printf '<html><body>Please log in</body></html>\n' > "$work/page.html"
: > "$work/empty.bin"

cat > "$work/server.py" <<'PY'
import http.server, os, sys
root = sys.argv[1]
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body=b"", ctype="application/pdf", extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        p = self.path.split("?")[0]
        read = lambda n: open(os.path.join(root, n), "rb").read()
        if p in ("/a.pdf", "/b.pdf", "/c.pdf", "/d.pdf"): return self.send(200, read(p[1:]))
        if p == "/octet.pdf": return self.send(200, read("a.pdf"), "application/octet-stream")
        if p == "/page.html": return self.send(200, read("page.html"), "text/html")
        if p == "/disguised.pdf": return self.send(200, read("page.html"), "application/pdf")
        if p == "/empty": return self.send(200, b"")
        if p == "/redirect": return self.send(302, b"", extra={"Location": "/a.pdf"})
        if p == "/redirect-c": return self.send(301, b"", extra={"Location": "/c.pdf"})
        if p == "/redirect-chain": return self.send(302, b"", extra={"Location": "/redirect"})
        if p == "/loop": return self.send(302, b"", extra={"Location": "/loop"})
        if p == "/gone": return self.send(410, b"gone", "text/plain")
        if p == "/boom": return self.send(500, b"error", "text/plain")
        return self.send(404, b"not found", "text/plain")
s = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
print(s.server_address[1], flush=True)
s.serve_forever()
PY
python3 "$work/server.py" "$work" > "$work/port.txt" &
server_pid=$!
for _ in $(seq 1 50); do [ -s "$work/port.txt" ] && break; sleep 0.1; done
port="$(cat "$work/port.txt")"
base="http://127.0.0.1:$port"
dead="http://127.0.0.1:1"

pass=0; fail=0
check() {  # check "name" expected_exit "grep -E pattern lines..." -- args
  local name="$1" want_exit="$2"; shift 2
  local patterns=() ; while [ "$1" != "--" ]; do patterns+=("$1"); shift; done; shift
  local out; out="$("$script" --quiet "$@" 2>/dev/null)"; local rc=$?
  local ok=1
  [ "$rc" -eq "$want_exit" ] || { ok=0; echo "   exit was $rc, wanted $want_exit"; }
  for p in "${patterns[@]}"; do printf '%s\n' "$out" | grep -qE "$p" || { ok=0; echo "   missing: $p"; }; done
  if [ "$ok" -eq 1 ]; then pass=$((pass + 1)); echo "PASS  $name"; else fail=$((fail + 1)); echo "FAIL  $name"; printf '%s\n' "$out" | sed 's/^/      /'; fi
}
absent() {  # absent "name" "pattern" -- args : the pattern must NOT appear
  local name="$1" pat="$2"; shift 3
  local out; out="$("$script" --quiet "$@" 2>/dev/null)"
  if printf '%s\n' "$out" | grep -qE "$pat"; then fail=$((fail + 1)); echo "FAIL  $name"; printf '%s\n' "$out" | sed 's/^/      /'; else pass=$((pass + 1)); echo "PASS  $name"; fi
}
T=$'\t'

check "equal bytes under two URLs are identical"              0 "^PAIR${T}1${T}2${T}identical" "^SUMMARY${T}identical" -- "$base/a.pdf" "$base/b.pdf"
check "different bytes are different, even with the same title" 1 "^PAIR${T}1${T}2${T}different" "^SUMMARY${T}different" -- "$base/a.pdf" "$base/c.pdf"
check "equal size but different bytes is different, never identical" 1 "^PAIR${T}1${T}2${T}different" -- "$base/a.pdf" "$base/d.pdf"
absent "equal size alone never produces the word identical" "^PAIR${T}1${T}2${T}identical" -- "$base/a.pdf" "$base/d.pdf"
check "one retrieved and one missing is unknown, not identical" 2 "^PAIR${T}1${T}2${T}unknown" "^RECORD${T}2${T}inaccessible${T}404" -- "$base/a.pdf" "$base/missing"
check "two inaccessible URLs are never identical"             2 "^PAIR${T}1${T}2${T}unknown" "^RECORD${T}1${T}inaccessible${T}404" "^RECORD${T}2${T}inaccessible${T}410" -- "$base/missing" "$base/gone"
absent "two inaccessible URLs never produce the word identical" "identical" -- "$base/missing" "$base/gone"
check "the same inaccessible URL twice is still not identical" 2 "^PAIR${T}1${T}2${T}unknown" -- "$base/missing" "$base/missing"
check "an HTML page with HTTP 200 is not-a-pdf and has no checksum" 2 "^RECORD${T}1${T}not-a-pdf${T}200${T}0${T}[0-9]+${T}-${T}" "^PAIR${T}1${T}2${T}unknown" -- "$base/page.html" "$base/a.pdf"
check "an HTML page labelled application/pdf is still not-a-pdf" 2 "^RECORD${T}1${T}not-a-pdf${T}200${T}0${T}[0-9]+${T}-${T}application/pdf" -- "$base/disguised.pdf"
check "a PDF served as octet-stream is retrieved, content type recorded" 0 "^RECORD${T}1${T}retrieved${T}200${T}0${T}[0-9]+${T}[0-9a-f]{64}${T}application/octet-stream" -- "$base/octet.pdf"
check "a redirect is followed and the final URL is recorded"  0 "^RECORD${T}1${T}retrieved${T}200${T}1${T}[0-9]+${T}[0-9a-f]{64}${T}application/pdf${T}${base}/a.pdf${T}${base}/redirect" "^PAIR${T}1${T}2${T}identical" -- "$base/redirect" "$base/a.pdf"
check "a redirect chain counts every hop"                      0 "^RECORD${T}1${T}retrieved${T}200${T}2${T}" -- "$base/redirect-chain"
check "a redirect to different bytes is different"             1 "^PAIR${T}1${T}2${T}different" -- "$base/redirect-c" "$base/a.pdf"
check "a redirect loop is inaccessible, not an endless wait"   2 "^RECORD${T}1${T}inaccessible" -- "$base/loop"
check "an empty body is inaccessible"                          2 "^RECORD${T}1${T}inaccessible${T}200${T}0${T}0${T}-" -- "$base/empty"
check "an HTTP 500 is inaccessible"                            2 "^RECORD${T}1${T}inaccessible${T}500" -- "$base/boom"
check "a refused connection is inaccessible"                   2 "^RECORD${T}1${T}inaccessible${T}000" "^PAIR${T}1${T}2${T}unknown" -- "$dead/x.pdf" "$base/a.pdf"
check "a single URL records retrieval and compares nothing"    0 "^RECORD${T}1${T}retrieved${T}200" "^SUMMARY${T}single" -- "$base/a.pdf"
check "file:// URLs work with no network (identical)"          0 "^PAIR${T}1${T}2${T}identical" -- "file://$work/a.pdf" "file://$work/b.pdf"
check "file:// URLs work with no network (different)"          1 "^PAIR${T}1${T}2${T}different" -- "file://$work/a.pdf" "file://$work/c.pdf"
check "a missing file:// URL is inaccessible"                  2 "^RECORD${T}1${T}inaccessible" -- "file://$work/nope.pdf"
check "three URLs: one different makes the overall result different" 1 "^PAIR${T}1${T}2${T}identical" "^PAIR${T}1${T}3${T}different" "^SUMMARY${T}different" -- "$base/a.pdf" "$base/b.pdf" "$base/c.pdf"
check "three URLs: one inaccessible leaves the overall result unknown" 2 "^PAIR${T}1${T}2${T}identical" "^PAIR${T}1${T}3${T}unknown" "^SUMMARY${T}unknown" -- "$base/a.pdf" "$base/b.pdf" "$base/missing"

# the checksum is of the real bytes
expected="$(sha256sum "$work/a.pdf" | cut -d' ' -f1)"
check "the recorded SHA-256 is the SHA-256 of the downloaded bytes" 0 "^RECORD${T}1${T}retrieved.*${expected}" -- "$base/a.pdf"
# usage error
"$script" >/dev/null 2>&1; rc=$?; if [ "$rc" -eq 64 ]; then pass=$((pass + 1)); echo "PASS  no arguments is a usage error (64)"; else fail=$((fail + 1)); echo "FAIL  no arguments exit was $rc"; fi

echo
echo "verify-dbe-sources: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
