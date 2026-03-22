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
        f"  Withdrawal rate        : {rate_pct:.1f}%",
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
    for row in results["survivalTable"]:
        pct = row["probabilitySolvent"] * 100
        bar_len = int(pct / 5)
        bar = "█" * bar_len
        lines.append(f"  {row['age']:<6} {pct:>6.1f}%  {bar}")

    lines += [
        "",
        f"  Probability of running out before age "
        f"{results['survivalTable'][-1]['age']}: {ruin_pct:.1f}%",
    ]
    return "\n".join(lines)


def format_solve_income(result: dict, people: list, target_solvency_pct: float, reference_age: int) -> str:
    monthly = result['monthlyIncome']
    annual = monthly * 12
    rate_pct = result['withdrawalRate'] * 100
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
        f'  {"Withdrawal rate":<20}: {rate_pct:.1f}%',
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
