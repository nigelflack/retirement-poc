import argparse
import json
import sys

from client import call_simulate
from formatter import format_results


def main():
    parser = argparse.ArgumentParser(description="Retirement model calculator CLI")
    parser.add_argument("--input", required=True, help="Path to JSON input file")
    parser.add_argument(
        "--server",
        default="http://localhost:3000",
        help="Server base URL (default: http://localhost:3000)",
    )
    parser.add_argument("--json", action="store_true", help="Output raw JSON response")
    args = parser.parse_args()

    try:
        with open(args.input) as f:
            payload = json.load(f)
    except FileNotFoundError:
        print(f"Error: Input file '{args.input}' not found.", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in input file: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        results = call_simulate(args.server, payload)
    except Exception as e:
        print(f"Error calling simulation server: {e}", file=sys.stderr)
        sys.exit(1)

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print(format_results(results))


if __name__ == "__main__":
    main()
