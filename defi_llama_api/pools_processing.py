
import pandas as pd
import random


def update_volume_usd_7d(row):
    if pd.isna(row["volumeUsd1d"]) or row["volumeUsd1d"] == 0:
        return int(random.uniform(row["tvlUsd"] / 30, row["tvlUsd"] / 15))
    return row["volumeUsd1d"]


if __name__ == "__main__":
    data = pd.read_csv("defi_llama_pools.csv")

    data = data.loc[
        data["project"].isin(
            [
                "uniswap-v3", "balancer-v3", 
                "curve-dex", "pancakeswap-amm-v3",
                "sushiswap", "raydium-amm", 
            ]
        )
    ]
    data = data.loc[
        data["stablecoin"]
    ]

    data["volumeUsd1d"] = data.apply(update_volume_usd_7d, axis=1)

    data = data.dropna(subset="tvlUsd")
    data = data.sort_values("tvlUsd", ascending=False)

    data.to_csv("defi_llama_pools_by_tvl.csv", index=False)
