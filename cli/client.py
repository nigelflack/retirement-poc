import warnings
warnings.filterwarnings("ignore", message=".*LibreSSL.*")
warnings.filterwarnings("ignore", message=".*OpenSSL.*")

import requests


def call_run(server_url: str, payload: dict) -> dict:
    url = f"{server_url.rstrip('/')}/run"
    response = requests.post(url, json=payload, timeout=60)
    response.raise_for_status()
    return response.json()
