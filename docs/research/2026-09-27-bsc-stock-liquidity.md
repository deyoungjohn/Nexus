# BSC tokenized-stock liquidity snapshot — 2026-09-27

**Finding.** bStocks has the only defensible top-20 **on-chain USDT-pool** ranking in this snapshot. Ondo has 12 equity pools visible against USDT but only five of those returned a wallet quote during the Sunday survey. xStocks has two tiny equity USDT pools and four equity quotes, three of which deteriorated by more than 56% between 100 and 10,000 USDT; the fourth (MSTRx) returned a dust-sized amount even at 100 USDT. It would be misleading to name 20 liquid Ondo or xStocks equities from these observations.

## Method and scope

At 13:31–13:45 UTC on Sunday 2026-09-27, I enumerated all BSC entries in [Binance Web3's tokenized-securities list](https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai): 458 Ondo, 128 xStocks and 80 bStocks, plus four Paimon SPV and one separately classified BNC4 record (671 total). For the **equity** comparison I used Binance `assetType=1`, plus the 17 bStocks equity tickers for which the feed omitted `assetType`: 329 Ondo, 96 xStocks and 67 bStocks. ETFs, yield products and the feed's four type-4 and one type-9 records are outside this three-provider equity comparison. This is the feed's product classification; some entries represent private-company exposure.

I queried [DEX Screener's BSC token-pair API](https://docs.dexscreener.com/api/reference) for every listed address and recorded the largest **direct stock/USDT pool's USDT-side reserve**, pool TVL and reported trailing-24-hour volume. The reserve is a pool-depth proxy, not a promise that the full amount is executable at the displayed price; concentrated liquidity and routing matter. I then requested a read-only [Binance Agentic Wallet](https://www.binance.com/en/academy/articles/what-are-bstocks-a-guide-to-tokenized-stocks-on-binance) USDT→token quote for **100 USDT on all 671 listings**, and for **1,000 and 10,000 USDT wherever the 100-USDT quote succeeded**. No order, approval, signature or transfer was submitted. The quote-deterioration column is `100 × [1 − (output at 10,000 / 10,000) / (output at 100 / 100)]`; negative readings are small quote movements or improvements. A quote is neither a price-fairness check nor an executed fill. Complete per-token observations are in [the CSV](2026-09-27-bsc-stock-liquidity.csv).

| Provider | Equity listings | 100-USDT quotes | Direct USDT equity pools | Interpretation |
| --- | ---: | ---: | ---: | --- |
| Ondo | 329 | 23 | 12 | 306 failed with a market-hours message; five pool-backed names quoted. |
| xStocks | 96 | 4 | 2 | 92 equities had no quote; successful quotes mostly had severe depth/price defects. |
| bStocks | 67 | 66 | 34 | One equity had no route; the ranked 20 all quoted at 100 and 10,000 USDT. |

## bStocks: 20 deepest observed direct USDT equity pools

Rank is by USDT-side reserve, requiring successful 100- and 10,000-USDT wallet quotes and ≤2% deterioration. Volume is the API's trailing 24 hours; values are approximate and changed during the survey. This ranks **BSC DEX depth**, not Binance's separate spot order book. [Binance describes bStocks as transferable BSC tokens with separate spot-market trading](https://www.binance.com/en/academy/articles/what-are-bstocks-a-guide-to-tokenized-stocks-on-binance).

| # | Token | USDT reserve | 24h pool volume (USD) | 10k quote deterioration | BSC contract |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | NVDAB | 1,492,287 | 187,962 | 0.007% | `0x02fca66c1d1afb4e2a7884261eb00f63598a7436` |
| 2 | TSLAB | 1,394,043 | 32,228 | 0.046% | `0x5b1910eaad6450e50f816082aa078c41f10c292f` |
| 3 | SPCXB | 1,250,031 | 87,486 | 0.009% | `0xbe9d156892e55e7154bcd3cb0fea677f9d3103e1` |
| 4 | BABAB | 736,198 | 152,884 | 0.186% | `0x4ef9d3062c7f6eba4aae4990c5036598c6eff4ec` |
| 5 | GOOGLB | 479,009 | 38,729 | 0.120% | `0x3f53de71c126bdabae20f9cd64848d317f6c3238` |
| 6 | CRCLB | 454,256 | 177,750 | -0.011% | `0x80f3d493ebce97e343c53d29a137942416b4ffc0` |
| 7 | SKHYB | 453,494 | 387,847 | 0.170% | `0xca750ef65f295bbecd685abf54e82caf297bdb61` |
| 8 | BNCB | 449,428 | 1,328,874 | 0.135% | `0x4902c5ebc598265ed2212b559b042de8a5eeec3f` |
| 9 | AAPLB | 371,831 | 558,967 | 0.037% | `0x431a3bee82e2ca41e49895cbece5bb0f76a89b7a` |
| 10 | MSTRB | 325,922 | 45,260 | -0.037% | `0xe87afb3076aeb0f9b14e368de8145ae6a2826a14` |
| 11 | MSFTB | 254,855 | 40,378 | -0.004% | `0x80106cb3ead06659a5ad19df39d9b4733863b9b0` |
| 12 | GMEB | 201,223 | 962,322 | 0.246% | `0x46ceefda28dd7207059ed19b0acdc026955bb15c` |
| 13 | METAB | 198,465 | 34,320 | 0.021% | `0x7425889fe94f9d693e8daefe88bcced6acfef4c0` |
| 14 | HOODB | 161,412 | 17,939 | 0.004% | `0xa394dcea3fd3847fd793afbfd163e2e3858b7c65` |
| 15 | INTCB | 154,987 | 29,085 | 0.003% | `0xe614e2fc6c787035ff51f452e8e826bfd32d5283` |
| 16 | SNDKB | 139,716 | 19,023 | 0.064% | `0x3ee4df61bd4f867e349beae8bfe07bc31b4850fb` |
| 17 | MRNAB | 131,023 | 33,460 | 0.416% | `0x5fd86da9b05abe396fe9d02a4a213a7c00556503` |
| 18 | BMNRB | 99,851 | 18,164 | -0.028% | `0x3548da95a9effe481e8604664d75e95821e557f5` |
| 19 | AMZNB | 86,666 | 4,604 | -0.003% | `0x1a4b499833a79a09ad7cf1d42d7dacf71e92eb00` |
| 20 | TSMB | 76,818 | 5,548 | 0.108% | `0xab78b89b5bb00236be0b4b20704cbfa04efc711c` |

## Ondo: fewer than 20 measurable pool candidates today

The 12 visible direct USDT equity pools rank below by reserve. `market_hours` is the wallet's exact class of rejection, not evidence the pool was empty. Another 18 Ondo equities without an observed direct USDT pool nevertheless quoted at 100, 1,000 and 10,000 USDT, through an unverified route; those quotes do not reveal executable pool depth. Because a weekend quote cannot establish regular-session availability, I cannot defensibly order a top 20 for Ondo from this snapshot.

| Pool rank | Token | USDT reserve | 100-USDT wallet quote | BSC contract |
| ---: | --- | ---: | --- | --- |
| 1 | DISon | 31,732 | market_hours | `0xeee9eee593cb8f7946260b4066cba7907f40acfa` |
| 2 | GMEon | 29,093 | market_hours | `0xdabb9aff4cf02f26d2014e4ca9f94ac6fe6572a3` |
| 3 | PDDon | 19,260 | market_hours | `0xf3e82ea164cb344b2b11bad4c24b0ea4f7ba4714` |
| 4 | BILIon | 18,583 | market_hours | `0x91fc7371d6de682a1e8cfcb4eb7da693312a03a4` |
| 5 | NVDAon | 11,887 | quoted | `0xa9ee28c80f960b889dfbd1902055218cba016f75` |
| 6 | SPCXon | 2,343 | quoted | `0xd0a58bc9d88d3ff48c0294cb7e45937d0e41a928` |
| 7 | GOOGLon | 1,365 | quoted | `0x091fc7778e6932d4009b087b191d1ee3bac5729a` |
| 8 | MCDon | 487 | market_hours | `0x995add4ba29a628a57930a8a185c62ca044ec090` |
| 9 | INTCon | 356 | quoted | `0xa528caaa2f96090e379d43f90834c75df54d6e74` |
| 10 | NKEon | 312 | market_hours | `0x04b5e199f2ec84f78b111035f57b16bee448db6f` |
| 11 | KOon | 131 | market_hours | `0x405f38b90bebf1259062cf29da299f3398662bcb` |
| 12 | AAPLon | 6 | quoted | `0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4` |

## xStocks: no defensible top 20

Only four of 96 equity listings returned a 100-USDT quote. The quote rows below show why a successful response alone is insufficient. CRCLx and MSTRx were the only equities with a direct USDT pool in the pair feed: about **9.6 and 0.5 USDT respectively**. HOODx and SPCXx had no observed direct pool; their larger quotes deteriorated sharply. MSTRx's 100-USDT output was effectively dust. The separate ETF SPYx also quoted but deteriorated **82.37%** at 10,000 USDT and is not a stock row. [xStocks' developer documentation](https://docs.xstocks.fi/developers) confirms separate EVM instruments and on-chain multipliers; deployment by itself does not establish a BSC trading route.

| Token | Output for 100 USDT | 10k quote deterioration | Direct USDT reserve | BSC contract |
| --- | ---: | ---: | ---: | --- |
| CRCLx | 0.083422366139343875 | 81.098% | 10 | `0xfebded1b0986a8ee107f5ab1a1c5a813491deceb` |
| HOODx | 0.231593046526857195 | 74.080% | none found | `0xe1385fdd5ffb10081cd52c56584f25efa9084015` |
| MSTRx | 0.00000002402461563 | 0.000% | 1 | `0xae2f842ef90c0d5213259ab82639d5bbf649b08e` |
| SPCXx | 0.66071266100821952 | 56.255% | none found | `0x68fa48b1c2fe52b3d776e1953e0e782b5044ce28` |

## Other BSC records in the same listing

The feed also lists four Paimon pre-IPO SPV tokens (`type=4`) and BNC4 (`type=9`, CEA Industries metadata). These are not part of the three established stock-provider cohorts; each family has fewer than 20 listings. Their read-only quotes and direct USDT pools were tested to complete the inventory. An SPV quote is not equivalent to a publicly traded share or to an executable Nexus route.

| Feed family | Token | 100-USDT quote | 10,000-USDT quote | Direct USDT reserve | BSC contract |
| --- | --- | --- | --- | ---: | --- |
| Other type 9 | BNC4 | quoted | quoted | 413,613 | `0x7c8d5502b544ddaf8852fc46d1174e34876d545c` |
| Paimon SPV | pPOLY | quoted | quoted | 53,106 | `0x1d80392d12caaaf9e333bb0bb7f021eacf297fe6` |
| Paimon SPV | xKLSH | quoted | quoted | none found | `0xe0cbb7ffc0883810569d84d78f02bbcb747cfe43` |
| Paimon SPV | xOPAI | quoted | quoted | 35,517 | `0x7ddef360f3c2db4cc41c3967984fefa2598cc9a6` |
| Paimon SPV | xSPCX | quoted | no_liquidity | none found | `0x05353dabf163fb2fec87f9e0f00f94eae4ac1631` |

**Decision use.** For a BSC DEX-first MVP, prioritize testing the bStocks top tier through Nexus's exact route, independent reference-price, audit, eligibility and simulation gates. Keep xStocks-first integration as a research target until a route demonstrates economically credible quotes; this report does **not** change the provider-priority decision in [ADR 0011](../decisions/0011-xstocks-first-bsc-provider.md). Recheck Ondo on an open regular session before comparing providers again. Pool data and wallet quotes were sampled over minutes, not from one atomic block; no live trade was performed and no application's execution gate was enabled.
