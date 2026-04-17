import warnings
warnings.filterwarnings("ignore", message=".*LibreSSL.*")
warnings.filterwarnings("ignore", message=".*OpenSSL.*")

import argparse
import json
import sys

from client import call_simulate
from formatter import format_run, format_debug

DEFAULT_TO_AGE = 100


def main():
    parser = argparse.ArgumentParser(description="Retirement model calculator CLI")
    parser.add_argument("--input", required=True, help="Path to scenario JSON input file")
    parser.add_argument(
        "--server",
        default="http://localhost:3000",
        help="Server base URL (default: http://localhost:3000)",
    )
    parser.add_argument("--json", action="store_true", help="Run once and output raw JSON")
    parser.add_argument("--debug", action="store_true", help="Print year-by-year debug table after results")
    args = parser.parse_args()

    try:
        with open(args.input) as f:
            scenario = json.load(f)
    except FileNotFoundError:
        print(f"Error: Input file '{args.input}' not found.", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in input file: {e}", file=sys.stderr)
        sys.exit(1)

    payload = {**scenario, "toAge": DEFAULT_TO_AGE, "debug": args.debug}

    if args.json:
        try:
            results = call_simulate(args.server, payload)
        except Exception as e:
            print(f"Error calling server: {e}", file=sys.stderr)
            sys.exit(1)
        print(json.dumps(results, indent=2))
        return

    while True:
        print()
        print("─" * 52)
        print("  Scenario")
        print("─" * 52)

        try:
            results = call_simulate(args.server, payload)
        except Exception as e:
            print(f"  Error calling server: {e}", file=sys.stderr)
        else:
            print(format_run(results))
            if args.debug and "resolvedYears" in results:
                print(format_debug(results))

        print()
        try:
            cont = input("Re-run scenario? [y/n]: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if cont != "y":
            break


if __name__ == "__main__":
    main()

