#!/usr/bin/env python3
import argparse, hashlib, json, subprocess, sys
from pathlib import Path

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

def main():
    ap = argparse.ArgumentParser(description="Run exact DFU HBOT CKS conformance fixtures.")
    ap.add_argument("--command", help="Adapter command. It receives one fixture-without-expected JSON object per line and must emit one JSON result per line.")
    ap.add_argument("--validate-bundle", action="store_true")
    ap.add_argument("--capability", choices=["regimen_range", "burden_questionnaire", "burden_analysis", "provider_roster"])
    args = ap.parse_args()
    root = Path(__file__).resolve().parent
    manifest = json.loads((root / "manifest.json").read_text())
    failures = []
    for item in manifest["files"]:
        path = root / item["path"]
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != item["sha256"]:
            failures.append(f"SHA-256 mismatch: {item['path']}")
    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 2
    fixtures = []
    seen = set()
    for entry in manifest["fixtures"]:
        fx = json.loads((root / entry["path"]).read_text())
        required = {"fixture_id", "capability", "operation", "input", "dependency_state", "expected"}
        if not required.issubset(fx) or not set(fx).issubset(required | {"input_json", "execution_context"}):
            failures.append(f"{entry['path']}: invalid fixture envelope")
        if fx.get("fixture_id") in seen:
            failures.append(f"{entry['path']}: duplicate fixture_id")
        seen.add(fx.get("fixture_id"))
        if not args.capability or fx["capability"] == args.capability:
            fixtures.append(fx)
    if args.validate_bundle and not args.command:
        print(f"bundle valid: {len(fixtures)} fixtures selected; {len(manifest['fixtures'])} total")
        return 0
    if not args.command:
        ap.error("--command is required unless --validate-bundle is used")
    proc = subprocess.Popen(args.command, shell=True, text=True, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    for fx in fixtures:
        payload = {k:v for k,v in fx.items() if k != "expected"}
        proc.stdin.write(canonical(payload) + "\n")
    proc.stdin.close()
    for fx in fixtures:
        line = proc.stdout.readline()
        if not line:
            failures.append(f"{fx['fixture_id']}: adapter returned no result")
            continue
        try:
            actual = json.loads(line)
        except Exception as exc:
            failures.append(f"{fx['fixture_id']}: invalid adapter JSON: {exc}")
            continue
        if canonical(actual) != canonical(fx["expected"]):
            failures.append(f"{fx['fixture_id']}: exact result mismatch\n expected={canonical(fx['expected'])}\n actual={canonical(actual)}")
    rc = proc.wait()
    if rc:
        failures.append(f"adapter exited {rc}")
    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    print(f"PASS: {len(fixtures)} exact fixtures")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
