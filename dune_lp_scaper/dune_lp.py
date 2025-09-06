import requests
import os

from dotenv import load_dotenv
load_dotenv("../.env")


API_KEY = os.getenv("DUNE_ANALYTICS_API")  # Replace with your actual API key

headers = {
    "X-Dune-API-Key": API_KEY
}


# TODO KNOWN DASHBOARD
url = "https://api.dune.com/api/v1/query/2632759/results/csv"
params = {
    "limit": 1000
}

response = requests.get(url, headers=headers, params=params)

if response.status_code == 200:
    with open("results.csv", "w") as f:
        f.write(response.text)
    print("Data saved to results.csv")
else:
    print(f"Error: {response.status_code} - {response.text}")