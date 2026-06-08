---
name: Theoretical Mode implementation
description: Paper trading simulation — design decisions, fee math, and DB schema for the Storm Bot theoretical mode
---

## Storm Trade exact fee math
- Open fee = 0.06% of notional (margin × leverage)
- Close fee = 0.06% of notional
- positionSizeBase = notional / entryPrice
- rawPnl (long) = (exitPrice - entryPrice) × positionSizeBase
- rawPnl (short) = (entryPrice - exitPrice) × positionSizeBase
- netPnl = rawPnl - openFee - closeFee
- pnlPercent = netPnl / margin × 100

## Balance accounting
- at open  → balance -= (margin + openFee)
- at close → balance += (margin + rawPnl - closeFee)
- net      → balance += netPnl (identical to real Storm Trade)

## DB columns added
- botStateTable: theoreticalMode (bool), theoreticalBalance (numeric)
- positionsTable: isTheoretical (bool)
- tradesTable: isTheoretical (bool), openFeeUsd (numeric), closeFeeUsd (numeric)

## API endpoints
- POST /bot/theoretical/start — sets theoreticalMode=true, theoreticalBalance=1000, starts loop
- POST /bot/theoretical/stop  — sets theoreticalMode=false, stops loop

## Bot loop design
- theoreticalMode skips wallet check and on-chain calls entirely
- Position sizing: 10% of current virtual balance, capped at maxPositionSizeUsd
- monitorOpenPositions filters by isTheoretical to match current mode
- [SIM] prefix on all log messages in theoretical mode

**Why:** Wallet import needed for real mode but shouldn't block overnight paper trading runs.
