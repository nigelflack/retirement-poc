import warnings
warnings.filterwarnings("ignore", message=".*LibreSSL.*")
warnings.filterwarnings("ignore", message=".*OpenSSL.*")

import requests


def call_simulate(server_url: str, payload: dict) -> dict:
    url = f"{server_url.rstrip('/')}/simulate"
    response = requests.post(url, json=payload, timeout=60)
    response.raise_for_status()
    return response.json()


def call_solve_income(server_url: str, payload: dict) -> dict:
    url = f"{server_url.rstrip('/')}/solve/income"
    response = requests.post(url, json=payload, timeout=60)
    response.raise_for_status()
    return response.json()


def call_solve_ages(server_url: str, payload: dict) -> dict:
    url = f"{server_url.rstrip('/')}/solve/ages"
    response = requests.post(url, json=payload, timeout=60)
    response.raise_for_status()
    return response.json()
