#!/usr/bin/env bash
# Fetch each URL, record its identity, and say which URLs are byte-identical.
#
# Run this from a machine that can reach education.gov.za (the Funda360 build environment cannot: its egress policy
# blocks that host). It prints a table you can paste into docs/sources/curriculum-source-register.md, and changes
# nothing in the repository or any database.
#
#   docs/sources/verify-dbe-sources.sh URL [URL...]
#
# Needs: curl and sha256sum (or shasum). pdfinfo and pdftotext (poppler) are used when present, for title, page count
# and ISBN. The SHA-256 is of the exact downloaded bytes. A different checksum means a different file even if the
# title matches, so never treat two URLs as the same document unless the checksums are equal.
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 URL [URL...]" >&2
  exit 2
fi

sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

declare -a urls sums
i=0
for url in "$@"; do
  i=$((i + 1)); f="$tmp/doc$i.bin"
  echo "== [$i] $url"
  if ! curl -fsSL --retry 2 --max-time 180 -o "$f" "$url"; then
    echo "   FAILED to download: record this URL as unreachable, not as verified"
    urls[$i]="$url"; sums[$i]="UNREACHABLE"; continue
  fi
  magic="$(head -c 5 "$f" || true)"
  size="$(wc -c < "$f" | tr -d ' ')"
  sum="$(sha "$f")"
  urls[$i]="$url"; sums[$i]="$sum"
  echo "   bytes:   $size"
  echo "   sha256:  $sum"
  if [ "$magic" != "%PDF-" ]; then echo "   WARNING: not a PDF (starts with '$magic'); the link may return an HTML page"; fi
  if command -v pdfinfo >/dev/null 2>&1; then
    pdfinfo "$f" 2>/dev/null | grep -E '^(Title|Pages|CreationDate|ModDate):' | sed 's/^/   /' || true
  fi
  if command -v pdftotext >/dev/null 2>&1; then
    isbn="$(pdftotext -l 4 "$f" - 2>/dev/null | grep -Eo 'ISBN[: ]*[0-9-]{10,17}' | head -1 || true)"
    [ -n "$isbn" ] && echo "   $isbn"
  fi
done

echo
echo "== Identity"
declare -A seen
downloaded=0
for k in $(seq 1 "$i"); do
  [ "${sums[$k]}" = "UNREACHABLE" ] && continue
  downloaded=$((downloaded + 1))
  seen["${sums[$k]}"]+=" [$k]"
done
if [ "$downloaded" -eq 0 ]; then echo "No URL could be downloaded, so nothing is verified."; exit 1; fi
for s in "${!seen[@]}"; do echo "sha256 ${s}: URLs${seen[$s]}"; done
unreachable=$((i - downloaded))
if [ "$unreachable" -gt 0 ]; then
  echo "RESULT: $unreachable of $i URLs could not be downloaded. Identity is NOT established for those; compare again once they are reachable."
fi
if [ "$downloaded" -lt 2 ]; then
  echo "Only one URL was downloaded, so there is nothing to compare."
elif [ "${#seen[@]}" -eq 1 ]; then
  echo "RESULT: the $downloaded downloaded URLs return the same bytes. Choose one canonical URL and record the others as aliases."
else
  echo "RESULT: the downloaded URLs return DIFFERENT files. Do not merge them. Record the differences and ask a curriculum specialist which edition applies."
fi
