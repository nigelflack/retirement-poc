def format_run(results: dict) -> str:
    retirement_age = results["householdRetirementAge"]
    retirement_name = results["householdRetirementName"]
    snap = results["accumulationSnapshot"]
    rate_pct = results["withdrawalRate"] * 100
    median_income = results["annualIncomeMedian"]
    p10_income = results["annualIncomeP10"]
    p90_income = results["annualIncomeP90"]
    ruin_pct = results["probabilityOfRuin"] * 100
    state_pensions = results.get("statePensions", [])
    real_col = "Real (today's £)"

    lines = [
        "",
        f"Simulations run        : {results['numSimulations']:,}",
        f"Household retires      : age {retirement_age} ({retirement_name}), "
        f"year {snap['yearsToRetirement']}",
        "",
        "  Accumulation at retirement",
        f"  {'Percentile':<8} {'Nominal':>16}  {real_col:>16}",
        f"  {'-' * 44}",
    ]
    for label, key in [("10th", "p10"), ("25th", "p25"), ("50th", "p50"), ("75th", "p75"), ("90th", "p90")]:
        lines.append(
            f"  {label:<8} £{snap['nominal'][key]:>15,.0f}  £{snap['real'][key]:>15,.0f}"
        )

    lines += [
        "",
        f"  Effective rate         : {rate_pct:.1f}%",
        f"  Annual income          : £{median_income:,.0f} median  "
        f"(£{p10_income:,.0f} – £{p90_income:,.0f} range)  (today's £)",
    ]

    if state_pensions:
        lines.append("  State pensions         :")
        for sp in state_pensions:
            lines.append(
                f"    {sp['name']:<12} £{sp['annualAmount']:,.0f}/yr  from age {sp['fromAge']}"
            )

    lines += [
        "",
        f"  {'Age':<6} {'Probability solvent':>20}",
        f"  {'─' * 28}",
    ]
    retirement_age = results["householdRetirementAge"]
    display_table = [
        row for row in results["survivalTable"]
        if (row["age"] - retirement_age) % 5 == 0
    ]
    for row in display_table:
        pct = row["probabilitySolvent"] * 100
        bar_len = int(pct / 5)
        bar = "█" * bar_len
        lines.append(f"  {row['age']:<6} {pct:>6.1f}%  {bar}")

    lines += [
        "",
        f"  Probability of running out before age "
        f"{display_table[-1]['age']}: {ruin_pct:.1f}%",
    ]
    return "\n".join(lines)


def format_debug(results: dict) -> str:
    """Prints a full year-by-year table from resolvedSchedules + portfolioPercentiles."""
    schedules = results.get("resolvedSchedules", {})
    contribution_by_year = schedules.get("contributionByYear", [])  # list of per-person lists
    income_target_by_year = schedules.get("incomeTargetByYear", [])
    capital_events_by_year = schedules.get("capitalEventsByYear", [])
    by_age = results.get("portfolioPercentiles", {}).get("byAge", [])

    retirement_age = results["householdRetirementAge"]
    people = results.get("statePensions", [])  # used only for count

    col_w = 12
    header = (
        f"  {'Year':<5} {'Age':<5} {'Phase':<10}"
        f" {'Contribution':>{col_w}} {'Income target':>{col_w}} {'Capital event':>{col_w}}"
        f" {'p10 real':>{col_w}} {'p50 real':>{col_w}} {'p90 real':>{col_w}}"
    )
    sep = "  " + "─" * (len(header) - 2)

    lines = ["", "  Year-by-year debug table", sep, header, sep]

    # Build lookup: age → real percentiles
    perc_lookup = {entry["age"]: entry["real"] for entry in by_age}

    num_years = max(len(income_target_by_year), len(by_age))
    # Determine reference currentAge from first byAge entry
    ref_start_age = by_age[0]["age"] - 1 if by_age else 0

    for y in range(num_years):
        age = ref_start_age + y + 1
        phase = "D" if age > retirement_age else "A"
        phase_label = f"{phase}  ← retire" if age == retirement_age + 1 else phase

        # Household contribution = sum across persons
        if contribution_by_year and y < len(contribution_by_year[0]):
            total_contrib = sum(person_arr[y] for person_arr in contribution_by_year)
            contrib_str = f"£{total_contrib:,.0f}" if total_contrib else "—"
        else:
            contrib_str = "—"

        income = income_target_by_year[y] if y < len(income_target_by_year) else 0
        income_str = f"£{income:,.0f}" if income else "—"

        cap = capital_events_by_year[y] if y < len(capital_events_by_year) else 0
        cap_str = f"£{cap:+,.0f}" if cap else "—"

        real = perc_lookup.get(age)
        if real:
            p10_str = f"£{real[9]:,.0f}"   # index 9 = p10
            p50_str = f"£{real[49]:,.0f}"  # index 49 = p50
            p90_str = f"£{real[89]:,.0f}"  # index 89 = p90
        else:
            p10_str = p50_str = p90_str = "—"

        lines.append(
            f"  {y:<5} {age:<5} {phase_label:<10}"
            f" {contrib_str:>{col_w}} {income_str:>{col_w}} {cap_str:>{col_w}}"
            f" {p10_str:>{col_w}} {p50_str:>{col_w}} {p90_str:>{col_w}}"
        )

    lines.append(sep)
    return "\n".join(lines)


def format_solve_income(result: dict, people: list, target_solvency_pct: float, reference_age: int) -> str:
    monthly = result['monthlyIncome']
    annual = monthly * 12
    survival_pct = result['survivalAtReferenceAge'] * 100
    ages_str = ', '.join(f"{p['name']} {p['retirementAge']}" for p in people)
    ref_label = f"Survival at {reference_age}"
    width = 47

    lines = [
        '',
        '  Solve: maximum sustainable income',
        f'  {"─" * width}',
        f'  {"Retirement ages":<20}: {ages_str}',
        f'  {"Target solvency":<20}: {target_solvency_pct:.0f}% at age {reference_age}',
        f'  {"Monthly income":<20}: £{monthly:,}',
        f'  {"Annual income":<20}: £{annual:,}',
        f'  {ref_label:<20}: {survival_pct:.1f}%',
    ]
    return '\n'.join(lines)


def format_solve_ages(result: dict, monthly_income: float, target_solvency_pct: float, reference_age: int) -> str:
    survival_pct = result['survivalAtReferenceAge'] * 100
    header_income = f'£{int(monthly_income):,}/month'
    header = f'Solve: earliest retirement ages for {header_income}'
    width = max(47, len(header))
    ref_label = f"Survival at {reference_age}"

    lines = [
        '',
        f'  {header}',
        f'  {"─" * width}',
        f'  {"Target solvency":<20}: {target_solvency_pct:.0f}% at age {reference_age}',
    ]
    for entry in result['retirementAges']:
        label = f"{entry['name']} retires at"
        lines.append(f'  {label:<20}: {entry["retirementAge"]}')
    lines += [
        f'  {"Monthly income":<20}: {header_income}',
        f'  {ref_label:<20}: {survival_pct:.1f}%',
    ]
    return '\n'.join(lines)
