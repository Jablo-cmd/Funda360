#!/usr/bin/env bash
# Retrieve each URL and report what can be PROVEN about it, and which URLs are byte-identical.
#
#   docs/sources/verify-dbe-sources.sh [--quiet] URL [URL...]
#
# Run it from a machine that can reach education.gov.za (the Funda360 build environment cannot: its egress policy
# blocks that host, and nobody should work around that). It changes nothing in the repository or any database.
#
# What it records for every URL
#   requested URL, state, HTTP status, final URL after redirects, number of redirects, content type, size,
#   and the SHA-256 of the exact downloaded bytes.
#
# States of a URL
#   retrieved      HTTP success and the bytes start with %PDF-. The only state that yields a checksum.
#   inaccessible   no usable response: network error, HTTP 4xx/5xx, redirect loop, empty body.
#   not-a-pdf      HTTP success but the bytes are not a PDF (often an HTML error or login page). No checksum is kept.
#   (redirected is an attribute, not a state: a redirected URL is still judged by the bytes it finally returns.)
#
# Relationship of each PAIR of URLs
#   identical      both retrieved, and the SHA-256 and the size are equal. Nothing else ever yields this word.
#   different      both retrieved, and the bytes differ.
#   unknown        at least one of the two was not retrieved. Two inaccessible URLs are NEVER identical.
#
# A title, a file name, a page count or a similar URL is never evidence of identity: only equal bytes are.
# Titles and page counts (from pdfinfo, when installed) are printed as information only.
#
# Output: a readable report, then machine-readable lines (tab separated):
#   RECORD  n  state  http_status  redirects  size  sha256  content_type  final_url  requested_url
#   PAIR    i  j  relation  reason
#   SUMMARY relation_overall
# Exit status: 0 all URLs retrieved and (if more than one) all identical; 1 at least one pair is different;
#              2 something could not be retrieved, so identity is not established; 64 usage error.
set -uo pipefail

quiet=0
if [ "${1:-}" = "--quiet" ]; then quiet=1; shift; fi
if [ "$#" -lt 1 ]; then
  echo "usage: $0 [--quiet] URL [URL...]" >&2
  exit 64
fi

sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
say() { if [ "$quiet" -eq 0 ]; then printf '%s\n' "$*"; fi; }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

declare -a R_url R_state R_status R_redirects R_size R_sha R_ctype R_final R_reason
n=0
for url in "$@"; do
  n=$((n + 1)); f="$tmp/doc$n.bin"; h="$tmp/head$n.txt"
  R_url[$n]="$url"; R_state[$n]="inaccessible"; R_status[$n]="000"; R_redirects[$n]="0"; R_size[$n]="0"; R_sha[$n]="-"; R_ctype[$n]="-"; R_final[$n]="$url"; R_reason[$n]=""
  say "== [$n] $url"

  meta="$(curl -sS -L --max-redirs 10 --max-time 180 --retry 1 -o "$f" -D "$h" \
            -w '%{http_code}|%{url_effective}|%{content_type}|%{size_download}|%{num_redirects}' "$url" 2>"$tmp/err$n.txt")"
  rc=$?
  IFS='|' read -r code final ctype size redirects <<<"$meta"
  R_status[$n]="${code:-000}"; R_final[$n]="${final:-$url}"; R_ctype[$n]="${ctype:--}"; R_size[$n]="${size:-0}"; R_redirects[$n]="${redirects:-0}"

  case "$url" in file://*) is_file=1 ;; *) is_file=0 ;; esac
  if [ "$rc" -ne 0 ]; then
    reason="curl failed (exit $rc): $(tr '\n' ' ' <"$tmp/err$n.txt" | cut -c1-160)"
    [ "$rc" -eq 47 ] && reason="too many redirects (possible redirect loop)"
    R_state[$n]="inaccessible"; R_reason[$n]="$reason"
  elif [ "$is_file" -eq 0 ] && { [ "${code:-000}" -ge 400 ] || [ "${code:-000}" -lt 200 ] || [ "${code:-000}" -ge 300 ]; }; then
    R_state[$n]="inaccessible"; R_reason[$n]="HTTP status ${code}"
  elif [ ! -s "$f" ]; then
    R_state[$n]="inaccessible"; R_reason[$n]="empty response body"
  elif [ "$(head -c 5 "$f" | od -An -c | tr -d ' \n')" != '%PDF-' ]; then
    R_state[$n]="not-a-pdf"; R_reason[$n]="the bytes do not start with %PDF- (starts with '$(head -c 12 "$f" | tr -c '[:print:]' '?')')"
    R_size[$n]="$(wc -c <"$f" | tr -d ' ')"
  else
    R_state[$n]="retrieved"; R_size[$n]="$(wc -c <"$f" | tr -d ' ')"; R_sha[$n]="$(sha "$f")"; R_reason[$n]="ok"
  fi

  say "   state:        ${R_state[$n]}${R_reason[$n]:+ (${R_reason[$n]})}"
  say "   http status:  ${R_status[$n]}"
  say "   final url:    ${R_final[$n]}$([ "${R_redirects[$n]}" != "0" ] && printf ' (after %s redirect(s))' "${R_redirects[$n]}")"
  say "   content type: ${R_ctype[$n]}"
  say "   size (bytes): ${R_size[$n]}"
  say "   sha256:       ${R_sha[$n]}"
  if [ "${R_state[$n]}" = "retrieved" ]; then
    if command -v pdfinfo >/dev/null 2>&1; then
      pdfinfo "$f" 2>/dev/null | grep -E '^(Title|Pages|CreationDate|ModDate):' | sed 's/^/   info (not evidence): /' || true
    fi
    if command -v pdftotext >/dev/null 2>&1; then
      isbn="$(pdftotext -l 4 "$f" - 2>/dev/null | grep -Eo 'ISBN[: ]*[0-9-]{10,17}' | head -1 || true)"
      [ -n "$isbn" ] && say "   info (not evidence): $isbn"
    fi
  fi
done

say ""
say "== Relationships (only equal bytes ever make two URLs identical)"
overall="identical"; any_unknown=0; any_different=0; pairs=0
for i in $(seq 1 "$n"); do
  for j in $(seq $((i + 1)) "$n"); do
    pairs=$((pairs + 1))
    if [ "${R_state[$i]}" != "retrieved" ] || [ "${R_state[$j]}" != "retrieved" ]; then
      rel="unknown"; why="not both retrieved: [$i] is ${R_state[$i]}, [$j] is ${R_state[$j]}"; any_unknown=1
    elif [ "${R_sha[$i]}" = "${R_sha[$j]}" ] && [ "${R_size[$i]}" = "${R_size[$j]}" ]; then
      rel="identical"; why="same SHA-256 and size"
    else
      rel="different"; why="SHA-256 differs"; any_different=1
      [ "${R_final[$i]}" = "${R_final[$j]}" ] && why="SHA-256 differs although both resolved to the same final URL"
    fi
    say "   [$i] vs [$j]: $rel ($why)"
    printf 'PAIR\t%s\t%s\t%s\t%s\n' "$i" "$j" "$rel" "$why"
  done
done

not_retrieved=0
for i in $(seq 1 "$n"); do
  printf 'RECORD\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$i" "${R_state[$i]}" "${R_status[$i]}" "${R_redirects[$i]}" "${R_size[$i]}" "${R_sha[$i]}" "${R_ctype[$i]}" "${R_final[$i]}" "${R_url[$i]}"
  [ "${R_state[$i]}" != "retrieved" ] && not_retrieved=$((not_retrieved + 1))
done

if [ "$any_different" -eq 1 ]; then overall="different"; elif [ "$any_unknown" -eq 1 ]; then overall="unknown"; elif [ "$pairs" -eq 0 ]; then overall="single"; fi
printf 'SUMMARY\t%s\n' "$overall"
case "$overall" in
  identical) say "RESULT: all $n URLs return the same bytes. Record one canonical URL, list the others as aliases, and record the SHA-256." ;;
  different) say "RESULT: the URLs return DIFFERENT files. Do not merge them. Record the difference and ask a curriculum specialist which edition applies." ;;
  unknown)   say "RESULT: identity is NOT established: $not_retrieved of $n URL(s) could not be retrieved as a PDF. Nothing is verified for those." ;;
  single)    say "RESULT: one URL, so there is nothing to compare. Retrieval is recorded; identity with any other URL is not." ;;
esac

[ "$not_retrieved" -gt 0 ] && exit 2
[ "$any_different" -eq 1 ] && exit 1
exit 0
