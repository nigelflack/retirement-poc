import warnings
warnings.filterwarnings("ignore", message=".*LibreSSL.*")
warnings.filterwarnings("ignore", message=".*OpenSSL.*")

import requests


def call_simulate(server_url: str, payload: dict) -> dict:
    url = f"{server_url.rstrip('/')}/simulate"
    response = requests.post(url, json=payload, timeout=30)
    response.raise_for_status()
    return response.json()


def call_drawdown(server_url: str, paths: list, real_paths: list, withdrawal_rate: float, retirement_age: int, to_age: int) -> dict:
    url = f"{server_url.rstrip('/')}/drawdown"
    payload = {
        "paths": paths,
        "realPaths": real_paths,
        "withdrawalRate": withdrawal_rate,
        "retirementAge": retirement_age,
        "toAge": to_age,
    }
    response = requests.post(url, json=payload, timeout=60)
    response.raise_for_status()
    return response.json()
