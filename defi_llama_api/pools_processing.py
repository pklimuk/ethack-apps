
import pandas as pd


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

    data = data.dropna(subset="tvlUsd")
    data = data.sort_values("tvlUsd", ascending=False)

    data.to_csv("defi_llama_pools_by_tvl.csv", index=False)
