import requests
import pandas as pd


if __name__ == "__main__":
    # Get all pools
    resp = requests.get("https://yields.llama.fi/pools")
    pools = resp.json()["data"]

    print(f"Total pools: {len(pools)}")
    print(pools[0])

    df = pd.DataFrame(pools)
    df.to_csv("defi_llama_pools.csv", index=False)
