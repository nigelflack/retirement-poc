import warnings
warnings.filterwarnings("ignore", message=".*LibreSSL.*")
warnings.filterwarnings("ignore", message=".*OpenSSL.*")

import argparse
import json
import sys

import requests

from client import call_simulate, call_solve_income, call_solve_ages
from formatter import format_run, format_debug, format_solve_income, format_solve_ages

DEFAULT_MONTHLY_INCOME = 3000.0
DEFAULT_TO_AGE = 100


def prompt_scenario(people: list, prev_retirement_ages: dict, prev_monthly_income: float):
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

    bracket = f" [{prev_monthly_income:,.0f}]"
    while True:
        try:
            raw = input(f"  Monthly income target (£/mo){bracket}: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            sys.exit(0)
        if raw == "":
            monthly_income = prev_monthly_income
            break
        try:
            monthly_income = float(raw)
            if monthly_income <= 0:
                print("  Please enter a positive number.")
                continue
            break
        except ValueError:
            print("  Please enter a number.")

    return updated_people, monthly_income


def prompt_solve_income(people: list, prev_retirement_ages: dict, prev_solvency_pct: float, prev_reference_age: int):
    """Prompt for solve-income parameters. Previous values shown in brackets; enter keeps them."""
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

    while True:
        try:
            raw = input(f"  Target solvency % [{prev_solvency_pct:.0f}]: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            sys.exit(0)
        if raw == "":
            solvency_pct = prev_solvency_pct
            break
        try:
            solvency_pct = float(raw)
            if solvency_pct <= 0 or solvency_pct >= 100:
                print("  Please enter a percentage between 0 and 100.")
                continue
            break
        except ValueError:
            print("  Please enter a number.")

    while True:
        try:
            raw = input(f"  Reference age [{prev_reference_age}]: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            sys.exit(0)
        if raw == "":
            reference_age = prev_reference_age
            break
        try:
            reference_age = int(raw)
            if reference_age <= 0:
                print("  Please enter a positive integer.")
                continue
            break
        except ValueError:
            print("  Please enter a whole number.")

    return updated_people, solvency_pct, reference_age


def prompt_solve_ages(people: list, prev_income: float, prev_floor_ages: dict, prev_solvency_pct: float, prev_reference_age: int):
    """Prompt for solve-ages parameters. Previous values shown in brackets; enter keeps them."""
    print()
    bracket = f" [{prev_income:,.0f}]" if prev_income is not None else ""
    while True:
        try:
            raw = input(f"  Monthly income target (£/month){bracket}: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            sys.exit(0)
        if raw == "" and prev_income is not None:
            monthly_income = prev_income
            break
        try:
            monthly_income = float(raw)
            if monthly_income <= 0:
                print("  Please enter a positive number.")
                continue
            break
        except ValueError:
            print("  Please enter a number.")

    updated_people = []
    for person in people:
        name = person["name"]
        current_age = person["currentAge"]
        prev = prev_floor_ages.get(name, 67)
        while True:
            try:
                raw = input(f"  Earliest retirement age for {name} (currently {current_age}) [{prev}]: ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                sys.exit(0)
            floor_age = prev if raw == "" else None
            if floor_age is None:
                try:
                    floor_age = int(raw)
                except ValueError:
                    print("  Please enter a whole number.")
                    continue
            if floor_age <= current_age:
                print(f"  Earliest retirement age must be greater than current age ({current_age}).")
                continue
            updated_people.append({**person, "retirementAge": floor_age})
            break

    while True:
        try:
            raw = input(f"  Target solvency % [{prev_solvency_pct:.0f}]: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            sys.exit(0)
        if raw == "":
            solvency_pct = prev_solvency_pct
            break
        try:
            solvency_pct = float(raw)
            if solvency_pct <= 0 or solvency_pct >= 100:
                print("  Please enter a percentage between 0 and 100.")
                continue
            break
        except ValueError:
            print("  Please enter a number.")

    while True:
        try:
            raw = input(f"  Reference age [{prev_reference_age}]: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            sys.exit(0)
        if raw == "":
            reference_age = prev_reference_age
            break
        try:
            reference_age = int(raw)
            if reference_age <= 0:
                print("  Please enter a positive integer.")
                continue
            break
        except ValueError:
            print("  Please enter a whole number.")

    return updated_people, monthly_income, solvency_pct, reference_age


def main():
    parser = argparse.ArgumentParser(description="Retirement model calculator CLI")
    parser.add_argument("--input", help="Path to JSON input file")
    parser.add_argument(
        "--server",
        default="http://localhost:3000",
        help="Server base URL (default: http://localhost:3000)",
    )
    parser.add_argument("--json", action="store_true", help="Run once and output raw JSON")
    parser.add_argument("--solve", choices=["income", "ages"], help="Solve mode: income or ages")
    parser.add_argument("--debug", action="store_true", help="Print year-by-year debug table after results")
    args = parser.parse_args()

    if not args.input:
        parser.error("--input is required")

    try:
        with open(args.input) as f:
            payload = json.load(f)
    except FileNotFoundError:
        print(f"Error: Input file '{args.input}' not found.", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in input file: {e}", file=sys.stderr)
        sys.exit(1)

    if args.solve == "income":
        prev_retirement_ages = {}
        prev_solvency_pct = 85.0
        prev_reference_age = 90

        while True:
            print()
            print("─" * 52)
            print("  Solve: income")
            print("─" * 52)

            people, solvency_pct, reference_age = prompt_solve_income(
                payload["people"], prev_retirement_ages, prev_solvency_pct, prev_reference_age
            )
            prev_retirement_ages = {p["name"]: p["retirementAge"] for p in people}
            prev_solvency_pct = solvency_pct
            prev_reference_age = reference_age

            solve_payload = {
                "people": people,
                "targetSolvencyPct": solvency_pct / 100,
                "referenceAge": reference_age,
                "toAge": DEFAULT_TO_AGE,
            }
            try:
                result = call_solve_income(args.server, solve_payload)
            except Exception as e:
                print(f"  Error calling server: {e}", file=sys.stderr)
                continue

            print(format_solve_income(result, people, solvency_pct, reference_age))

            print()
            try:
                cont = input("Re-run scenario? [y/n]: ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                print()
                break
            if cont != "y":
                break

    elif args.solve == "ages":
        prev_income = None
        prev_floor_ages = {}
        prev_solvency_pct = 85.0
        prev_reference_age = 90

        while True:
            print()
            print("─" * 52)
            print("  Solve: ages")
            print("─" * 52)

            people, monthly_income, solvency_pct, reference_age = prompt_solve_ages(
                payload["people"], prev_income, prev_floor_ages, prev_solvency_pct, prev_reference_age
            )
            prev_income = monthly_income
            prev_floor_ages = {p["name"]: p["retirementAge"] for p in people}
            prev_solvency_pct = solvency_pct
            prev_reference_age = reference_age

            solve_payload = {
                "people": people,
                "monthlyIncome": monthly_income,
                "targetSolvencyPct": solvency_pct / 100,
                "referenceAge": reference_age,
                "toAge": DEFAULT_TO_AGE,
            }
            try:
                result = call_solve_ages(args.server, solve_payload)
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 422:
                    print("  Could not find retirement ages that satisfy the target. Try a lower income or solvency %.")
                else:
                    print(f"  Error calling server: {e}", file=sys.stderr)
                continue
            except Exception as e:
                print(f"  Error calling server: {e}", file=sys.stderr)
                continue

            print(format_solve_ages(result, monthly_income, solvency_pct, reference_age))

            print()
            try:
                cont = input("Re-run scenario? [y/n]: ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                print()
                break
            if cont != "y":
                break

    elif args.json:
        people, monthly_income = prompt_scenario(payload["people"], {}, payload.get("annualIncomeTarget", DEFAULT_MONTHLY_INCOME * 12) / 12)
        run_payload = {
            "people": people,
            "annualIncomeTarget": monthly_income * 12,
            "toAge": DEFAULT_TO_AGE,
            "debug": args.debug,
        }
        if "incomeSchedule" in payload:
            run_payload["incomeSchedule"] = payload["incomeSchedule"]
        if "capitalEvents" in payload:
            run_payload["capitalEvents"] = payload["capitalEvents"]
        try:
            results = call_simulate(args.server, run_payload)
        except Exception as e:
            print(f"Error calling server: {e}", file=sys.stderr)
            sys.exit(1)
        print(json.dumps(results, indent=2))
        return

    else:
        prev_retirement_ages = {}
        prev_monthly_income = payload.get("annualIncomeTarget", DEFAULT_MONTHLY_INCOME * 12) / 12

        while True:
            print()
            print("─" * 52)
            print("  Scenario")
            print("─" * 52)

            people, monthly_income = prompt_scenario(
                payload["people"], prev_retirement_ages, prev_monthly_income
            )
            prev_retirement_ages = {p["name"]: p["retirementAge"] for p in people}
            prev_monthly_income = monthly_income

            run_payload = {
                "people": people,
                "annualIncomeTarget": monthly_income * 12,
                "toAge": DEFAULT_TO_AGE,
                "debug": args.debug,
            }
            if "incomeSchedule" in payload:
                run_payload["incomeSchedule"] = payload["incomeSchedule"]
            if "capitalEvents" in payload:
                run_payload["capitalEvents"] = payload["capitalEvents"]

            try:
                results = call_simulate(args.server, run_payload)
            except Exception as e:
                print(f"  Error calling server: {e}", file=sys.stderr)
                continue

            print(format_run(results))
            if args.debug and "resolvedSchedules" in results:
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

