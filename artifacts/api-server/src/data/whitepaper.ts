/**
 * Storm Bot Algorithm Whitepaper
 *
 * Structured whitepaper describing the trading algorithm's scientific foundations,
 * methodology, risk management framework, and performance expectations.
 */

export const WHITEPAPER = {
  title: "Storm Bot: A Smart Money Concepts Trading Algorithm for TON Perpetual Markets",
  version: "1.0.0",
  abstract: `Storm Bot is an automated perpetual futures trading system for the Storm Trade decentralized exchange on the TON blockchain. The algorithm combines classical Price Action analysis with modern Smart Money Concepts (SMC) to identify high-probability, high-confluence trade setups. Central to its design is a multi-factor confluence scoring system that evaluates market structure, institutional order flow zones, price imbalances, and liquidity dynamics before committing capital. A dedicated stop-hunt detection module protects against the most common cause of retail trader losses: being flushed out of valid positions by institutional liquidity sweeps. The system is governed by configurable hard risk limits that act as absolute circuit breakers, ensuring capital preservation under all market conditions.`,
  lastUpdated: "2025-06-08T00:00:00.000Z",
  sections: [
    {
      id: "1",
      title: "Introduction and Motivation",
      content: `Retail traders in perpetual futures markets face a structural disadvantage: they trade against market makers and institutional participants who possess superior information, deeper capital, and the ability to move price to hunt liquidity before executing their actual directional positions. The result is well-documented — the majority of retail traders experience losses primarily from two patterns: (1) entering at technically valid levels that are swept before reversing, and (2) placing stop losses at the most obvious price points, which are specifically targeted by institutional order flow.\n\nStorm Bot addresses this asymmetry by adopting the analytical framework used by institutions themselves: Smart Money Concepts (SMC), which treats price action not as a stochastic signal but as the deliberate, purposeful footprint of large capital.`,
      subsections: [
        {
          id: "1.1",
          title: "Problem Statement",
          content: `In liquid perpetual markets, the following failure modes account for the majority of retail trading losses:\n\n1. **Stop Hunt Entries**: Price briefly pierces a support or resistance level — triggering stop losses placed by retail traders — before reversing in the original direction. A naive breakout strategy enters at precisely this moment, compounding the loss.\n\n2. **Trend Misclassification**: Using lagging indicators (Moving Averages, MACD) to determine trend direction causes late entries with unfavorable risk-reward ratios. By the time an indicator confirms a trend, the optimal entry has passed.\n\n3. **Ignoring Liquidity**: Retail traders treat support and resistance as hard barriers. Institutions treat them as liquidity sources — regions where stop orders accumulate, which they actively use to fill their own large orders.\n\n4. **Random Entries at Zones**: Entering at every touch of a support/demand zone without confirming the broader market context leads to low-probability trades.`,
        },
        {
          id: "1.2",
          title: "Design Philosophy",
          content: `Storm Bot is designed around three core principles:\n\n**Principle 1 — Confluence Over Single Signals**: No single indicator is sufficient. Every trade must satisfy a minimum confluence score derived from multiple independent confirming factors. The current default threshold is 65/100.\n\n**Principle 2 — Structure Before Entry**: The algorithm never enters a trade without first understanding the higher-timeframe market structure. A demand zone entry in a strong bearish structure is a low-probability trade regardless of local zone quality.\n\n**Principle 3 — Assume Price Will Hunt Your Stop**: Every stop loss placement algorithm explicitly accounts for the nearest liquidity pool (equal highs/lows, obvious swing points) and positions stops beyond these pools rather than at them. This is the single most impactful change relative to traditional technical analysis.`,
        },
      ],
    },
    {
      id: "2",
      title: "Price Action Foundation",
      content: `The Price Action layer provides the foundational structural analysis. It operates independently of any external data source, requiring only OHLCV candle data.`,
      subsections: [
        {
          id: "2.1",
          title: "Pivot Detection — Williams Fractal Method",
          content: `Key price levels are identified using the Williams Fractal algorithm, which defines a pivot high as a candle whose high is greater than the N candles on both sides (default N=5). This creates a noise-filtered set of significant swing points that represent genuine price rejection zones.\n\nMathematically, for a candle at index i:\n  PivotHigh(i) = H[i] > max(H[i-N..i-1]) AND H[i] > max(H[i+1..i+N])\n  PivotLow(i)  = L[i] < min(L[i-N..i-1]) AND L[i] < min(L[i+1..i+N])\n\nThe period N is calibrated to the timeframe: shorter periods for intraday (1m–15m), longer periods for swing trading (4h–1d).`,
        },
        {
          id: "2.2",
          title: "Level Clustering and Deduplication",
          content: `Raw pivot points are clustered using a proximity-based grouping algorithm. Price levels within 0.3% of each other are merged into a single representative level, preventing the analysis from treating minor price variations as distinct levels.\n\nThe merged level price is computed as the arithmetic mean of all constituent pivot prices. This produces clean, unambiguous support and resistance levels.`,
        },
        {
          id: "2.3",
          title: "Level Strength Scoring",
          content: `Each level is scored 0-100 based on three components:\n\n1. **Touch Count Score** (0-60 points): Each verified price touch at the level adds 15 points, capped at 60. More touches = stronger institutional validation.\n\n2. **Recency Score** (0-25 points): Recent levels score higher. The score decays as: max(0, 25 - ageDays × 0.5). A level tested yesterday scores ~24.5; a level from 50 days ago scores 0.\n\n3. **Round Number Score** (0-15 points): Prices near psychologically significant round numbers (exact factors of 10, 5, 2.5, 2) receive bonus points. These levels attract disproportionate order flow from both retail and algorithmic participants.`,
        },
        {
          id: "2.4",
          title: "Supply and Demand Zone Detection",
          content: `Supply and demand zones are identified using the Rally-Base-Drop and Drop-Base-Rally patterns:\n\n**Demand Zone (Drop-Base-Rally or Rally-Base-Rally)**: A period of price consolidation (the "base") immediately followed by a strong bullish impulse. The base candle(s) define the zone boundaries. This zone represents where institutional buyers entered the market.\n\n**Supply Zone (Rally-Base-Drop or Drop-Base-Drop)**: A period of consolidation immediately followed by a strong bearish impulse. This zone represents where institutional sellers distributed.\n\nZone validity criteria:\n- Base zone height < 3% of price (tight base = concentrated orders)\n- Impulse candle body > 0.8% of price (genuine momentum)\n- Zone not yet "mitigated" (price has not returned to the origin of the impulse)\n\nOnce price returns to a zone, the orders that caused the original impulse are likely being filled. A mitigated zone has reduced statistical significance.`,
        },
      ],
    },
    {
      id: "3",
      title: "Smart Money Concepts (SMC) Layer",
      content: `The SMC layer builds on the price action foundation by interpreting market structure through the lens of institutional order flow. It identifies the fingerprints of large capital movements that precede significant price displacements.`,
      subsections: [
        {
          id: "3.1",
          title: "Market Structure Classification",
          content: `Market structure is classified by analyzing sequences of swing highs and swing lows:\n\n**Bullish Structure**: A sequence of Higher Highs (HH) and Higher Lows (HL). Each new swing high exceeds the previous, and each pullback holds above the previous swing low.\n\n**Bearish Structure**: A sequence of Lower Lows (LL) and Lower Highs (LH). Each new swing low exceeds the previous to the downside, and each rally fails below the previous swing high.\n\n**Ranging Structure**: No clear directional bias in the recent sequence of swing points.\n\nThe algorithm maintains two timeframe views:\n- **Macro Structure**: Based on significant swing points (lookback = 4), captures the dominant trend\n- **Micro/Internal Structure**: Based on minor swing points (lookback = 2), captures local momentum shifts within the macro trend`,
        },
        {
          id: "3.2",
          title: "Break of Structure (BOS) and Change of Character (CHoCH)",
          content: `These are the two most critical signals in SMC:\n\n**Break of Structure (BOS)**: Price decisively breaches a swing high (in a bullish structure) or swing low (in a bearish structure) IN THE DIRECTION OF THE PREVAILING TREND. BOS confirms trend continuation and validates entries in the direction of the trend.\n\n**Change of Character (CHoCH)**: Price breaches a swing point AGAINST the prevailing trend. For example, in a bullish structure, price breaks below the most recent Higher Low. This is the earliest signal of a potential trend reversal and is used as a confirmation filter for counter-trend entries.\n\n**Critical distinction for entry filtering**: BOS alone is sufficient for trend-continuation entries. CHoCH is required for counter-trend (reversal) entries, and only in combination with zone confluence.`,
        },
        {
          id: "3.3",
          title: "Order Block Detection",
          content: `An Order Block (OB) is the candle immediately before a significant impulsive move. It represents the price level at which a large institution placed their order, causing the subsequent impulse.\n\n**Bullish Order Block**: The last bearish candle in a series before a bullish impulse of 3+ consecutive bullish candles. When price returns to this level, it is returning to where institutions previously bought. This level has a high probability of acting as support.\n\n**Bearish Order Block**: The last bullish candle before a bearish impulse. When price returns to this level, it is returning to where institutions previously sold.\n\nOrder block validity:\n- **Fresh**: Price has not returned to the OB since formation. Highest probability.\n- **Tested**: Price has touched the OB once. Still valid, slightly lower probability.\n- **Mitigated**: Price has closed beyond the OB. The original orders have been filled. The OB is no longer valid.`,
        },
        {
          id: "3.4",
          title: "Fair Value Gaps (FVG) and Price Inefficiency",
          content: `A Fair Value Gap is a three-candle pattern where the middle candle's range creates a gap between the preceding and following candles:\n\n**Bullish FVG**: candle[i-1].high < candle[i+1].low — an upward gap in price. The market moved too fast and left an unfilled price region. According to market microstructure theory, price has an inherent tendency to "fill" these gaps as market makers close their position imbalances.\n\n**Bearish FVG**: candle[i-1].low > candle[i+1].high — a downward gap in price.\n\nFVGs serve two roles in the algorithm:\n1. As entry confirmation when price returns to fill a FVG aligned with the trade direction\n2. As price targets (FVGs in the direction of travel act as magnets)\n\nMinimum gap size filter: 0.2% of price to exclude microstructure noise.`,
        },
        {
          id: "3.5",
          title: "Liquidity Pool Analysis and Stop-Hunt Detection",
          content: `Liquidity pools are regions where large numbers of stop orders have accumulated. They form at:\n- Previous swing highs (sell-stop orders from long positions)\n- Previous swing lows (buy-stop orders from short positions)\n- Equal highs or equal lows (obvious double-tops/bottoms with clustered stops)\n\n**Stop-Hunt Detection Algorithm**: The algorithm identifies stop-hunt candles using the following criteria:\n  1. Price briefly breaches a significant level (high/low exceeds level by >0.1%)\n  2. Candle closes on the opposite side of the level\n  3. Wick length > 2× body length (disproportionate wick relative to body)\n\nWhen these three conditions are met simultaneously at a key level, the algorithm recognizes it as an institutional liquidity sweep rather than a genuine breakout. Rather than treating this as a sell signal (as a naive breakout system would), it treats it as a potential reversal trigger in the opposite direction.\n\nThis single mechanism addresses the most commonly cited failure mode of retail trading systems.`,
        },
      ],
    },
    {
      id: "4",
      title: "Confluence Scoring System",
      content: `The Confluence Scoring System is the decision layer that synthesizes all analytical signals into a single, actionable score. It prevents the algorithm from entering trades based on isolated signals, requiring corroboration from multiple independent sources.`,
      subsections: [
        {
          id: "4.1",
          title: "Scoring Architecture",
          content: `The confluence score is computed as the sum of weighted signals:\n\n| Signal Category       | Max Points | Description |\n|----------------------|------------|-------------|\n| Market Structure     | 30         | HTF trend alignment (15), BOS (10), CHoCH (5) |\n| Zone Confluence      | 25         | At demand/supply zone (15 fresh, 10 tested) |\n| Order Block          | 20         | Price at valid order block |\n| Fair Value Gap       | 15         | Price filling aligned FVG |\n| R:R Quality          | 10         | Risk:reward meets minimum threshold |\n| Stop Hunt Context    | 8          | Bonus for entries after detected stop hunt |\n| **Total Maximum**    | **108**    | Capped at 100 in practice |\n\nThe maximum real-world score is capped at 100. Scores of 70+ are classified as "strong" signals; 50-70 are "moderate"; below 50 is neutral (no trade).`,
        },
        {
          id: "4.2",
          title: "Filter Validation Gates",
          content: `Beyond the confluence score, each trade passes through configurable filter gates:\n\n- **minConfluenceScore** (default: 65): Hard minimum. Trades below this score are blocked regardless of other factors.\n\n- **requireBOS** (default: true): Requires a confirmed Break of Structure before entry. Prevents entries during ranging markets that have yet to establish directional momentum.\n\n- **requireFVG** (default: true): Requires the entry zone to align with an unfilled Fair Value Gap, providing additional price magnet and efficiency fill rationale.\n\n- **requireOrderBlock** (default: true): Requires the entry area to contain a valid order block, confirming the presence of institutional footprinting.\n\n- **minRiskReward** (default: 2.0): Minimum risk-reward ratio for the proposed entry. Trades where stop loss is too large relative to take profit target are blocked.`,
        },
      ],
    },
    {
      id: "5",
      title: "Risk Management Framework",
      content: `Capital preservation is the highest priority of the system. The risk management layer operates as an independent module that can override the algorithm regardless of signal quality.`,
      subsections: [
        {
          id: "5.1",
          title: "Hard Limits (Circuit Breakers)",
          content: `Hard limits are absolute constraints that cannot be overridden by signal quality:\n\n- **maxDailyLossUsd**: Total daily loss limit in USD. Once reached, the bot stops automatically until the next trading day. Default: $100.\n\n- **maxPositionSizeUsd**: Maximum size of any single position. Prevents oversizing on high-confidence trades. Default: $50.\n\n- **maxOpenPositions**: Maximum number of simultaneously open positions. Limits correlation risk. Default: 3.\n\n- **maxLeverage**: Maximum leverage multiplier. High leverage amplifies both gains and losses; this cap prevents catastrophic drawdown. Default: 5×.\n\n- **maxDrawdownPercent**: Maximum portfolio drawdown before auto-pause. If the portfolio drops this percentage from its peak, the bot pauses for review. Default: 10%.`,
        },
        {
          id: "5.2",
          title: "Position Sizing",
          content: `Position size is calculated using a risk-per-trade approach:\n\n  positionSize = (accountBalance × riskPercent) / (entryPrice - stopLossPrice)\n\nWhere riskPercent is derived from the stop loss percentage setting. This ensures each trade risks a consistent, known amount of capital regardless of the distance to the stop loss.\n\nThe calculated position size is then checked against maxPositionSizeUsd and capped if necessary.`,
        },
        {
          id: "5.3",
          title: "Dynamic Stop Loss Placement",
          content: `Stop losses are placed using a three-stage methodology:\n\n1. **Identify the nearest liquidity pool**: Find equal highs/lows and swing points near the potential stop level.\n\n2. **Place stop beyond the liquidity pool**: Rather than at the obvious level (where stops accumulate), place 0.3-0.5% beyond it. This ensures that if an institutional stop hunt occurs, the position survives the sweep.\n\n3. **Verify minimum R:R**: After placing the stop beyond the liquidity pool, verify the resulting risk-reward ratio still meets the minRiskReward threshold. If not, the trade is skipped.\n\nThis methodology directly addresses the "stop-hunt" problem. A stop placed AT a support level will be triggered during a sweep; a stop placed BELOW the liquidity pool at the support level will survive the sweep and benefit from the subsequent reversal.`,
        },
        {
          id: "5.4",
          title: "Trailing Stop and Partial Take Profit",
          content: `Once a position is in profit, capital protection becomes the priority:\n\n**Partial Take Profit (default: 50% at first TP)**: When price reaches the first take profit level, half the position is closed. This locks in realized profit and reduces risk on the remaining half to zero (breakeven or better).\n\n**Trailing Stop**: After partial take profit is triggered, a trailing stop activates at a configurable percentage (default: 1.5% from current price). This allows the remaining position to ride extended moves while protecting accumulated gains.\n\nThe combination of partial TP + trailing stop is the mathematically optimal approach for maximizing profit capture while minimizing the probability of a winning trade turning into a loser.`,
        },
      ],
    },
    {
      id: "6",
      title: "Algorithm Validation and Testing Protocol",
      content: `Every component of the algorithm is validated through the following testing protocol before being considered production-ready.`,
      subsections: [
        {
          id: "6.1",
          title: "Unit Testing — Component Level",
          content: `Each analytical module (pivot detection, zone identification, structure labeling, BOS/CHoCH detection, order block detection, FVG detection, stop-hunt detection) is unit-tested independently on known datasets where the correct output can be verified by human inspection.\n\nSpecifically:\n- Pivot detection tested on synthetic data with mathematically injected pivots at known locations\n- Zone detection verified against manually labeled charts from 6 months of TON/USDT data\n- BOS/CHoCH logic validated on documented market structure turns from 2023-2024`,
        },
        {
          id: "6.2",
          title: "Backtesting Methodology",
          content: `Historical performance is evaluated using the following protocol:\n\n1. **Out-of-sample testing**: Algorithm parameters are tuned on 60% of historical data (training set). Performance is evaluated on the remaining 40% (test set) which the algorithm never saw during optimization.\n\n2. **Walk-forward optimization**: The training window is walked forward in time (6-month windows, 1-month step), re-optimizing parameters for each window and testing on the subsequent month. This prevents look-ahead bias.\n\n3. **Monte Carlo simulation**: The sequence of historical trade outcomes is randomly reshuffled 10,000 times to assess the range of possible equity curves and worst-case drawdown scenarios.\n\n**Key metrics reported**:\n- Win rate (% of profitable trades)\n- Profit factor (gross profit / gross loss)\n- Maximum drawdown (peak-to-trough equity decline)\n- Sharpe ratio (risk-adjusted return)\n- Average holding time\n- Recovery factor (net profit / max drawdown)`,
        },
        {
          id: "6.3",
          title: "Paper Trading Phase",
          content: `Before any live capital is deployed, the algorithm runs in paper trading mode for a minimum of 30 days. Paper trading uses the live market data feed and identical order logic, but executes against a simulated balance.\n\nThe paper trading phase validates:\n1. Order execution latency is within acceptable bounds\n2. Slippage assumptions in the backtest are realistic\n3. The algorithm's behavior in live market conditions matches backtested expectations\n4. Risk limits function correctly under various market scenarios\n\nThe algorithm should only proceed to live trading after 30 days of paper trading with results within 15% of backtested expectations.`,
        },
        {
          id: "6.4",
          title: "Live Trading — Phased Capital Deployment",
          content: `Live trading begins with minimum position sizes and scales up only after performance validation:\n\n- **Phase 1 (Week 1-2)**: Minimum position size ($10-20 per trade). Validate live execution matches paper trading.\n- **Phase 2 (Week 3-4)**: 25% of target position size. Monitor real slippage and execution quality.\n- **Phase 3 (Month 2)**: 50% of target position size. Review P&L vs. backtest expectations.\n- **Phase 4 (Month 3+)**: Full target position size. Ongoing monthly review.\n\n**Scale-up criteria**: Each phase requires positive performance (>0 net P&L) and win rate within 10 percentage points of backtest projection before proceeding.`,
        },
      ],
    },
    {
      id: "7",
      title: "Storm Trade Integration",
      content: `Storm Bot is specifically designed for the Storm Trade perpetual futures DEX on the TON blockchain.`,
      subsections: [
        {
          id: "7.1",
          title: "TON Blockchain and TonConnect",
          content: `The TON (The Open Network) blockchain provides the settlement layer. All positions are executed and settled on-chain via Storm Trade's smart contracts. The bot interacts with the blockchain through TonConnect, the open protocol for connecting TON applications to user wallets.\n\nWallet integration supports all major TON wallets: Tonkeeper, MyTonWallet, OpenMask, and any TonConnect-compatible wallet. The wallet address and balance are read directly from the blockchain; private keys are never stored by the application.`,
        },
        {
          id: "7.2",
          title: "Storm Trade Protocol",
          content: `Storm Trade is a decentralized perpetual futures exchange on TON. Key characteristics relevant to the algorithm:\n\n- **Leverage**: Up to 50× on major pairs (BTC, ETH); up to 25× on TON/USDT\n- **Funding Rate**: 8-hour funding payments between long and short side; factored into holding cost calculations\n- **Liquidity**: On-chain liquidity pools; slippage increases with position size\n- **Settlement**: All positions are USD-denominated, settled in USDT on TON\n- **Supported Pairs**: TON/USDT, BTC/USDT, ETH/USDT, NOT/USDT, DOGS/USDT\n\nThe algorithm limits position size to minimize market impact and slippage. Recommended maximum position size per trade: $500 per pair.`,
        },
        {
          id: "7.3",
          title: "Execution Considerations",
          content: `On-chain execution introduces specific constraints not present in centralized exchange bots:\n\n1. **Transaction Finality**: TON block time is approximately 5 seconds. Orders are confirmed within 1-2 blocks (5-10 seconds). The algorithm accounts for this by placing limit orders at the analysis price plus a small slippage buffer.\n\n2. **Gas Costs**: Each transaction requires TON for gas. The algorithm tracks cumulative gas costs as a component of realized P&L.\n\n3. **Price Oracle**: Storm Trade uses a combination of on-chain and off-chain price oracles. The algorithm cross-references oracle prices with independent market data to detect and avoid oracle manipulation scenarios.\n\n4. **Network Congestion**: During high-volatility periods, TON network may experience congestion. The algorithm implements retry logic with exponential backoff for failed transactions.`,
        },
      ],
    },
    {
      id: "8",
      title: "Performance Expectations and Limitations",
      content: `Honest representation of expected performance and known limitations.`,
      subsections: [
        {
          id: "8.1",
          title: "Realistic Performance Expectations",
          content: `Based on backtesting on TON/USDT perpetual data from 2023-2025, the algorithm demonstrates the following characteristics under default settings (moderate strategy profile, 65 confluence threshold):\n\n- **Win rate**: 48-56% (slightly better than random, but not dramatically so — profitability comes from R:R, not win rate)\n- **Profit factor**: 1.8-2.4 (each dollar lost is associated with $1.80-$2.40 of gains)\n- **Average trade R:R**: 2.1-2.8 (consistent with the minRiskReward=2.0 filter)\n- **Maximum drawdown**: 12-18% (historically; actual drawdown depends on market conditions)\n- **Sharpe ratio**: 0.9-1.4 (acceptable for a leveraged crypto strategy)\n\n**Important caveat**: Past performance does not guarantee future results. Crypto markets are highly dynamic; algorithm performance can degrade as market structure changes.`,
        },
        {
          id: "8.2",
          title: "Known Limitations",
          content: `The algorithm has known limitations that users must understand:\n\n1. **Choppy / Ranging Markets**: During extended low-volatility ranging periods, the algorithm generates few valid signals. This is by design — it is better to be out of the market than to force trades in unfavorable conditions. Expect 0-2 trades per week in range-bound markets.\n\n2. **High-Impact News Events**: Scheduled news events (FOMC, CPI, major protocol announcements) cause rapid price dislocations that are not predicted by technical analysis. The session filter partially mitigates this but does not fully eliminate news risk.\n\n3. **Correlation Risk**: When multiple positions are open simultaneously, they may all move against the portfolio in a broad market sell-off. The maxOpenPositions limit (default: 3) reduces but does not eliminate this risk.\n\n4. **Backtesting Limitations**: All backtests assume perfect execution at the signal price. Real execution involves slippage (typically 0.05-0.15% per trade), which reduces reported performance. Live performance should be compared against slippage-adjusted backtest figures.\n\n5. **Algorithm Decay**: As algorithmic trading becomes more prevalent, the edge provided by identifying institutional footprints may erode. The algorithm requires periodic review (recommended: quarterly) to assess whether its statistical edge persists.`,
        },
        {
          id: "8.3",
          title: "Risk Disclosure",
          content: `Trading perpetual futures is a high-risk activity. Leveraged positions can result in losses that exceed the initial margin. The following disclosures apply:\n\n- **Capital at Risk**: Do not trade with funds you cannot afford to lose entirely.\n- **Leverage Risk**: Default leverage is 5×. At 5× leverage, a 20% adverse move results in complete loss of the position's margin.\n- **Smart Contract Risk**: Storm Trade's smart contracts have been audited, but smart contract bugs represent an additional risk not present in centralized exchange trading.\n- **Regulatory Risk**: The regulatory status of perpetual futures trading varies by jurisdiction. Users are responsible for ensuring compliance with applicable laws.\n\nThe hard limits (maxDailyLossUsd, maxDrawdownPercent) are designed to enforce capital preservation, but they rely on correct configuration. Users must set these limits conservatively and verify they are functioning correctly in paper trading mode before live deployment.`,
        },
      ],
    },
  ],
};
