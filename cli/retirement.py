import argparse
import json
import sys

from client import call_simulate, call_drawdown
from formatter import format_results, format_drawdown

DEFAULT_WITHDRAWAL_RATE = 4.0
DEFAULT_TO_AGE = 100


def prompt_retirement_ages(people: list) -> list:
    """Prompt for each person's retirement age and return an updated copy."""
    print()
    updated = []
    for person in people:
        name = person["name"]
        current_age = person["currentAge"]
        while True:
            try:
                raw = input(f"  Retirement age for {name} (currently {current_age}): ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                sys.exit(0)
            try:
                retirement_age = int(raw)
                if retirement_age <= current_age:
                    print(f"  Retirement age must be greater than current age ({current_age}).")
                    continue
                updated.append({**person, "retirementAge": retirement_age})
                break
            except ValueError:
                print("  Please enter a whole number.")
    return updated


def main():
    parser = argparse.ArgumentParser(description="Retirement model calculator CLI")
    parser.add_argument("--input", required=True, help="Path to JSON input file")
    parser.add_argument(
        "--server",
        default="http://localhost:3000",
        help="Server base URL (default: http://localhost:3000)",
    )
    parser.add_argument("--json", action="store_true", help="Output raw JSON response (skips interactive session)")
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

    print("\n── Retirement ages ──────────────────────────────────")
    payload["people"] = prompt_retirement_ages(payload["people"])

    try:
        results = call_simulate(args.server, payload)
    except Exception as e:
        print(f"Error calling simulation server: {e}", file=sys.stderr)
        sys.exit(1)

    if args.json:
        print(json.dumps(results, indent=2))
        return

    print(format_results(results))

    paths = results["household"]["paths"]
    real_paths = results["household"]["realPaths"]
    earliest = min(payload["people"], key=lambda p: p["retirementAge"] - p["currentAge"])
    retirement_age = earliest["retirementAge"]
    to_age = DEFAULT_TO_AGE
    last_rate = DEFAULT_WITHDRAWAL_RATE

    # Collect state pensions from input JSON (optional field per person).
    state_pensions = [
        {
            "name": p["name"],
            "annualAmount": p["statePension"]["annualAmount"],
            "fromAge": p["statePension"]["fromAge"],
        }
        for p in payload["people"]
        if "statePension" in p
    ]

    print()
    print("─" * 52)
    print("  Drawdown explorer")
    print("─" * 52)
    print(f"  Household retires : age {retirement_age} ({earliest['name']})")

    while True:
        try:
            raw = input(f"  Withdrawal rate % [{last_rate:.1f}] (or 'q' to quit): ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if raw.lower() == "q":
            break

        if raw == "":
            rate_pct = last_rate
        else:
            try:
                rate_pct = float(raw)
                if rate_pct <= 0 or rate_pct >= 100:
                    print("  Please enter a percentage between 0 and 100.")
                    continue
            except ValueError:
                print("  Please enter a number or 'q' to quit.")
                continue

        last_rate = rate_pct

        try:
            drawdown_results = call_drawdown(
                args.server, paths, real_paths, rate_pct / 100, retirement_age, to_age,
                state_pensions=state_pensions or None,
            )
        except Exception as e:
            print(f"  Error calling drawdown server: {e}", file=sys.stderr)
            continue

        print()
        print(format_drawdown(drawdown_results))
        print()


if __name__ == "__main__":
    main()
