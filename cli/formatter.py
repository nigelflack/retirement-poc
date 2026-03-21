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
