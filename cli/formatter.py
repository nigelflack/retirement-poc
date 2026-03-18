def _percentile_rows(nominal: dict, real: dict) -> list:
    rows = []
    real_col = "Real (today's £)"
    header = f"  {'Percentile':<8} {'Nominal':>16}  {real_col:>16}"
    divider = f"  {'-' * 44}"
    rows.append(header)
    rows.append(divider)
    for label, key in [("10th", "p10"), ("25th", "p25"), ("50th", "p50"), ("75th", "p75"), ("90th", "p90")]:
        rows.append(f"  {label:<8} £{nominal[key]:>15,.0f}  £{real[key]:>15,.0f}")
    return rows


def format_results(results: dict) -> str:
    lines = [f"Simulations run : {results['numSimulations']:,}", ""]

    for person in results["people"]:
        lines.append(f"── {person['name']} (years to retirement: {person['yearsToRetirement']}) ──")
        lines.extend(_percentile_rows(person["nominal"], person["real"]))
        lines.append("")

    h = results["household"]
    lines.append(f"── Household combined (at year {h['yearsToSnapshot']}) ──")
    lines.extend(_percentile_rows(h["nominal"], h["real"]))

    return "\n".join(lines)
