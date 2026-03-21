import argparse
import json
import sys

from client import call_run
from formatter import format_run

DEFAULT_WITHDRAWAL_RATE = 4.0
DEFAULT_TO_AGE = 100


def prompt_scenario(people: list, prev_retirement_ages: dict, prev_withdrawal_rate: float):
    """Prompt for all scenario parameters. Previous values shown in brackets; enter keeps them."""
    print()
    updated_people = []
    for person in people:
        name = person["name"]
        current_age = person["currentAge"]
        prev = prev_retirement_ages.get(name)
        bracket = f" [{prev}]" if prev is not None else ""
        while True:
            try:
                raw = input(f"  Retirement age for {name} (currently {current_age}){bracket}: ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                sys.exit(0)
            if raw == "" and prev is not None:
                updated_people.append({**person, "retirementAge": prev})
                break
            try:
                retirement_age = int(raw)
                if retirement_age <= current_age:
                    print(f"  Retirement age must be greater than current age ({current_age}).")
                    continue
                updated_people.append({**person, "retirementAge": retirement_age})
                break
            except ValueError:
                print("  Please enter a whole number.")

    bracket = f" [{prev_withdrawal_rate:.1f}]"
    while True:
        try:
            raw = input(f"  Withdrawal rate %{bracket}: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            sys.exit(0)
        if raw == "":
            rate_pct = prev_withdrawal_rate
            break
        try:
            rate_pct = float(raw)
            if rate_pct <= 0 or rate_pct >= 100:
                print("  Please enter a percentage between 0 and 100.")
                continue
            break
        except ValueError:
            print("  Please enter a number.")

    return updated_people, rate_pct


def main():
    parser = argparse.ArgumentParser(description="Retirement model calculator CLI")
    parser.add_argument("--input", required=True, help="Path to JSON input file")
    parser.add_argument(
        "--server",
        default="http://localhost:3000",
        help="Server base URL (default: http://localhost:3000)",
    )
    parser.add_argument("--json", action="store_true", help="Run once and output raw JSON")
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

    if args.json:
        people, rate_pct = prompt_scenario(payload["people"], {}, DEFAULT_WITHDRAWAL_RATE)
        run_payload = {"people": people, "withdrawalRate": rate_pct / 100, "toAge": DEFAULT_TO_AGE}
        try:
            results = call_run(args.server, run_payload)
        except Exception as e:
            print(f"Error calling server: {e}", file=sys.stderr)
            sys.exit(1)
        print(json.dumps(results, indent=2))
        return

    prev_retirement_ages = {}
    prev_withdrawal_rate = DEFAULT_WITHDRAWAL_RATE

    while True:
        print()
        print("─" * 52)
        print("  Scenario")
        print("─" * 52)

        people, rate_pct = prompt_scenario(
            payload["people"], prev_retirement_ages, prev_withdrawal_rate
        )
        prev_retirement_ages = {p["name"]: p["retirementAge"] for p in people}
        prev_withdrawal_rate = rate_pct

        run_payload = {
            "people": people,
            "withdrawalRate": rate_pct / 100,
            "toAge": DEFAULT_TO_AGE,
        }

        try:
            results = call_run(args.server, run_payload)
        except Exception as e:
            print(f"  Error calling server: {e}", file=sys.stderr)
            continue

        print(format_run(results))

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

