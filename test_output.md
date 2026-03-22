
[1m[46m RUN [49m[22m [36mv4.1.0 [39m[90mC:/Users/Usuario/Warx/xwar[39m

 [32m✓[39m src/engine/__tests__/combat.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 12[2mms[22m[39m
 [31m❯[39m src/engine/__tests__/elections.test.ts [2m([22m[2m31 tests[22m[2m | [22m[31m1 failed[39m[2m)[22m[32m 19[2mms[22m[39m
     [32m✓[39m returns >= 1 for any input (minimum voice)[32m 2[2mms[22m[39m
     [32m✓[39m veteran has higher PP than newcomer[32m 0[2mms[22m[39m
     [32m✓[39m 5 newcomers collectively outweigh 1 veteran[32m 0[2mms[22m[39m
     [32m✓[39m 10 newcomers vastly outvote 1 veteran[32m 0[2mms[22m[39m
     [32m✓[39m exhibits diminishing returns: 4x damage → ~2x PP from damage[32m 0[2mms[22m[39m
     [32m✓[39m each source contributes independently[32m 0[2mms[22m[39m
     [32m✓[39m negative inputs are clamped to 0[32m 0[2mms[22m[39m
     [32m✓[39m returns individual source contributions that sum to total[32m 0[2mms[22m[39m
     [32m✓[39m damage is the dominant source for combat-heavy players[32m 0[2mms[22m[39m
     [32m✓[39m production is dominant for eco players[32m 0[2mms[22m[39m
     [32m✓[39m picks candidate with highest weighted votes when coalition met[32m 0[2mms[22m[39m
     [32m✓[39m disqualifies candidate below coalition threshold[32m 0[2mms[22m[39m
     [32m✓[39m newcomers collectively beat veteran via weighted votes[32m 0[2mms[22m[39m
     [32m✓[39m returns null winner when no candidates meet threshold[32m 0[2mms[22m[39m
     [32m✓[39m returns null winner when there are no votes[32m 0[2mms[22m[39m
     [32m✓[39m breaks ties by coalition size (broader support wins)[32m 0[2mms[22m[39m
     [32m✓[39m respects custom coalition threshold[32m 0[2mms[22m[39m
     [32m✓[39m deduplicates voter IDs (same voter cannot inflate coalition)[32m 0[2mms[22m[39m
     [32m✓[39m keeps entries within the window[32m 0[2mms[22m[39m
     [32m✓[39m removes entries older than the window[32m 0[2mms[22m[39m
     [32m✓[39m supports custom window size[32m 0[2mms[22m[39m
     [32m✓[39m returns empty array when all entries are expired[32m 0[2mms[22m[39m
     [32m✓[39m sums contributions by type within the window[32m 0[2mms[22m[39m
[31m     [31m×[31m excludes entries outside the rolling window[39m[32m 8[2mms[22m[39m
     [32m✓[39m returns level-only PP when no entries[32m 0[2mms[22m[39m
     [32m✓[39m excludes activity from before joining the country[32m 0[2mms[22m[39m
     [32m✓[39m allows up to 30 days of prior activity for long-time members[32m 0[2mms[22m[39m
     [32m✓[39m new joiner (just joined) gets zero PP from old activity[32m 0[2mms[22m[39m
     [32m✓[39m recent country switcher loses old-country work beyond join window[32m 0[2mms[22m[39m
     [32m✓[39m veteran vs newcomer coalition — newcomers win[32m 0[2mms[22m[39m
     [32m✓[39m inactive player has minimal but non-zero PP[32m 0[2mms[22m[39m
 [32m✓[39m src/engine/__tests__/economy.test.ts [2m([22m[2m30 tests[22m[2m)[22m[32m 10[2mms[22m[39m
 [32m✓[39m src/engine/__tests__/damage-by-division.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 23[2mms[22m[39m
[90mstdout[2m | src/engine/__tests__/balance-report.test.ts[2m > [22m[2m§1 — 30-Day Economy Flow Simulation[2m > [22m[2mNew Player: 30-day money & bitcoin flows
[22m[39m
╔═══════════════════════════════════════════════════════════╗
║  NEW PLAYER           — 30-Day Economy Flows            ║
╚═══════════════════════════════════════════════════════════╝

  ── MONEY ($) ──
  CREATED (faucets):
    Daily Login               +     765.000  (47.5%)
    Work Earnings             +     450.000  (27.9%)
    War Win (share)           +     345.000  (21.4%)
    War Loss (share)          +      51.000  (3.2%)
    TOTAL CREATED             +   1.611.000
  DESTROYED (sinks):
    Division Heal             -   2.160.000  (76.8%)
    Division Recruit          -     480.000  (17.1%)
    Division Revive           -     120.000  (4.3%)
    Division Insurance        -      48.000  (1.7%)
    Company Build             -        5000  (0.2%)
    TOTAL DESTROYED           -   2.813.000
    NET                          -1.202.000  📉

  ── BITCOIN (₿) ──
  CREATED (faucets):
    Daily Login               +          16  (88.9%)
    Battle Loot Drop          +           2  (11.1%)
    TOTAL CREATED             +          18
  DESTROYED (sinks):
    Company Upgrade           -           2  (66.7%)
    Company Build             -           1  (33.3%)
    TOTAL DESTROYED           -           3
    NET                       +           15  📈

  ── RESOURCES ──
    Oil destroyed:   4800
    Scrap destroyed: 2600

[90mstdout[2m | src/engine/__tests__/balance-report.test.ts[2m > [22m[2m§1 — 30-Day Economy Flow Simulation[2m > [22m[2mMid-Tier: 30-day money & bitcoin flows
[22m[39m
╔═══════════════════════════════════════════════════════════╗
║  MID-TIER             — 30-Day Economy Flows            ║
╚═══════════════════════════════════════════════════════════╝

  ── MONEY ($) ──
  CREATED (faucets):
    War Win (share)           +   1.725.000  (52.8%)
    Daily Login               +     765.000  (23.4%)
    Work Earnings             +     630.000  (19.3%)
    War Loss (share)          +     127.500  (3.9%)
    Prospection Success       +      20.000  (0.6%)
    TOTAL CREATED             +   3.267.500
  DESTROYED (sinks):
    Division Heal             -   6.220.800  (78.8%)
    Division Recruit          -   1.350.000  (17.1%)
    Division Revive           -     180.000  (2.3%)
    Division Insurance        -     135.000  (1.7%)
    Company Build             -        5000  (0.1%)
    TOTAL DESTROYED           -   7.890.800
    NET                          -4.623.300  📉

  ── BITCOIN (₿) ──
  CREATED (faucets):
    Prospection Success       +          44  (52.4%)
    Produce (Industrialist)   +          24  (28.6%)
    Daily Login               +          16  (19.0%)
    TOTAL CREATED             +          84
  DESTROYED (sinks):
    Prospection Cost          -          30  (90.9%)
    Company Upgrade           -           2  (6.1%)
    Company Build             -           1  (3.0%)
    TOTAL DESTROYED           -          33
    NET                       +           51  📈

  ── RESOURCES ──
    Oil destroyed:   15.000
    Scrap destroyed: 6600

[90mstdout[2m | src/engine/__tests__/balance-report.test.ts[2m > [22m[2m§1 — 30-Day Economy Flow Simulation[2m > [22m[2mWhale: 30-day money & bitcoin flows
[22m[39m
╔═══════════════════════════════════════════════════════════╗
║  WHALE                — 30-Day Economy Flows            ║
╚═══════════════════════════════════════════════════════════╝

  ── MONEY ($) ──
  CREATED (faucets):
    War Win (share)           +   5.175.000  (76.7%)
    Daily Login               +     765.000  (11.3%)
    Work Earnings             +     750.000  (11.1%)
    Prospection Success       +      55.000  (0.8%)
    TOTAL CREATED             +   6.745.000
  DESTROYED (sinks):
    Division Heal             -   9.126.000  (69.8%)
    Division Recruit          -   3.300.000  (25.3%)
    Division Insurance        -     330.000  (2.5%)
    Division Revive           -     300.000  (2.3%)
    Company Build             -      10.000  (0.1%)
    TOTAL DESTROYED           -  13.066.000
    NET                          -6.321.000  📉

  ── BITCOIN (₿) ──
  CREATED (faucets):
    Prospection Success       +         121  (64.7%)
    Produce (Industrialist)   +          49  (26.2%)
    Daily Login               +          16  (8.6%)
    Battle Loot Drop          +           1  (0.5%)
    TOTAL CREATED             +         187
  DESTROYED (sinks):
    Prospection Cost          -          30  (88.2%)
    Company Build             -           2  (5.9%)
    Company Upgrade           -           2  (5.9%)
    TOTAL DESTROYED           -          34
    NET                       +          153  📈

  ── RESOURCES ──
    Oil destroyed:   55.500
    Scrap destroyed: 12.000

[90mstdout[2m | src/engine/__tests__/balance-report.test.ts[2m > [22m[2m§1 — 30-Day Economy Flow Simulation[2m > [22m[2mmoney & bitcoin net summary across all segments
[22m[39m
╔═══════════════════════════════════════════════════════════╗
║        CROSS-SEGMENT ECONOMY SUMMARY                    ║
╚═══════════════════════════════════════════════════════════╝

  ┌──────────────┬──────────────┬──────────────┬──────────────┐
  │ Segment      │ $ Created    │ $ Destroyed  │ $ NET        │
  ├──────────────┼──────────────┼──────────────┼──────────────┤
  │ New Player   │ $ 1.611.000 │ $ 2.813.000 │ $-1.202.000 │
  │ Mid-Tier     │ $ 3.267.500 │ $ 7.890.800 │ $-4.623.300 │
  │ Whale        │ $ 6.740.000 │ $13.066.000 │ $-6.326.000 │
  └──────────────┴──────────────┴──────────────┴──────────────┘

  ┌──────────────┬──────────────┬──────────────┬──────────────┐
  │ Segment      │ ₿ Created    │ ₿ Destroyed  │ ₿ NET        │
  ├──────────────┼──────────────┼──────────────┼──────────────┤
  │ New Player   │           16 │            3 │ +         13 │
  │ Mid-Tier     │           77 │           33 │ +         44 │
  │ Whale        │          175 │           34 │ +        141 │
  └──────────────┴──────────────┴──────────────┴──────────────┘

[90mstdout[2m | src/engine/__tests__/balance-report.test.ts[2m > [22m[2m§2 — DPS-per-Cost Efficiency Matrix[2m > [22m[2mprints full efficiency matrix for mid-tier player
[22m[39m
===== DPS-PER-COST EFFICIENCY MATRIX (Mid-Tier Player) =====
┌─────────┬──────────────┬──────────────┬─────────┬───────────┬──────┬─────┬─────────┬─────────┬─────────┬──────┬────────┬───────┬─────────┬─────────┐
│ (index) │ Division     │ Group        │ Avg DPT │ $         │ Oil  │ Pop │ DPS/$1K │ DPS/Oil │ DPS/Pop │ HP   │ HP/$1K │ Speed │ Crit%   │ Miss%   │
├─────────┼──────────────┼──────────────┼─────────┼───────────┼──────┼─────┼─────────┼─────────┼─────────┼──────┼────────┼───────┼─────────┼─────────┤
│ 0       │ [32m'RECON     '[39m │ [32m'infantry  '[39m │ [33m34[39m      │ [32m'40.000'[39m  │ [33m400[39m  │ [33m1[39m   │ [33m0.85[39m    │ [33m0.09[39m    │ [33m34[39m      │ [33m3840[39m │ [33m96[39m     │ [33m1.5[39m   │ [32m'9.3%'[39m  │ [32m'55.0%'[39m │
│ 1       │ [32m'ASSAULT   '[39m │ [32m'infantry  '[39m │ [33m112[39m     │ [32m'60.000'[39m  │ [33m600[39m  │ [33m1[39m   │ [33m1.87[39m    │ [33m0.19[39m    │ [33m112[39m     │ [33m4608[39m │ [33m76.8[39m   │ [33m1[39m     │ [32m'15.9%'[39m │ [32m'50.1%'[39m │
│ 2       │ [32m'SNIPER    '[39m │ [32m'infantry  '[39m │ [33m238[39m     │ [32m'80.000'[39m  │ [33m500[39m  │ [33m1[39m   │ [33m2.98[39m    │ [33m0.48[39m    │ [33m238[39m     │ [33m3840[39m │ [33m48[39m     │ [33m0.6[39m   │ [32m'26.3%'[39m │ [32m'31.4%'[39m │
│ 3       │ [32m'RPG       '[39m │ [32m'infantry  '[39m │ [33m182[39m     │ [32m'100.000'[39m │ [33m800[39m  │ [33m1[39m   │ [33m1.82[39m    │ [33m0.23[39m    │ [33m182[39m     │ [33m4800[39m │ [33m48[39m     │ [33m0.8[39m   │ [32m'18.7%'[39m │ [32m'49.5%'[39m │
│ 4       │ [32m'JEEP      '[39m │ [32m'mechanized'[39m │ [33m99[39m      │ [32m'100.000'[39m │ [33m1500[39m │ [33m2[39m   │ [33m0.99[39m    │ [33m0.07[39m    │ [33m49[39m      │ [33m4800[39m │ [33m48[39m     │ [33m1.3[39m   │ [32m'16.5%'[39m │ [32m'40.4%'[39m │
│ 5       │ [32m'TANK      '[39m │ [32m'mechanized'[39m │ [33m417[39m     │ [32m'150.000'[39m │ [33m2500[39m │ [33m2[39m   │ [33m2.78[39m    │ [33m0.17[39m    │ [33m208[39m     │ [33m5760[39m │ [33m38.4[39m   │ [33m0.5[39m   │ [32m'21.0%'[39m │ [32m'33.9%'[39m │
│ 6       │ [32m'JET       '[39m │ [32m'mechanized'[39m │ [33m435[39m     │ [32m'200.000'[39m │ [33m3000[39m │ [33m2[39m   │ [33m2.17[39m    │ [33m0.14[39m    │ [33m217[39m     │ [33m4160[39m │ [33m20.8[39m   │ [33m0.7[39m   │ [32m'34.5%'[39m │ [32m'21.6%'[39m │
│ 7       │ [32m'WARSHIP   '[39m │ [32m'mechanized'[39m │ [33m983[39m     │ [32m'250.000'[39m │ [33m4000[39m │ [33m2[39m   │ [33m3.93[39m    │ [33m0.25[39m    │ [33m491[39m     │ [33m6400[39m │ [33m25.6[39m   │ [33m0.4[39m   │ [32m'24.6%'[39m │ [32m'38.9%'[39m │
│ 8       │ [32m'SUBMARINE '[39m │ [32m'mechanized'[39m │ [33m1688[39m    │ [32m'300.000'[39m │ [33m6000[39m │ [33m2[39m   │ [33m5.63[39m    │ [33m0.28[39m    │ [33m844[39m     │ [33m8000[39m │ [33m26.67[39m  │ [33m0.45[39m  │ [32m'39.0%'[39m │ [32m'15.0%'[39m │
└─────────┴──────────────┴──────────────┴─────────┴───────────┴──────┴─────┴─────────┴─────────┴─────────┴──────┴────────┴───────┴─────────┴─────────┘

  Average DPS/$1K: 2.56
  ⚠️  OUTLIERS (>2× average):
    submarine: 5.63 DPS/$1K

[90mstdout[2m | src/engine/__tests__/balance-report.test.ts[2m > [22m[2m§2 — DPS-per-Cost Efficiency Matrix[2m > [22m[2minfantry has better DPS/$1K ratio than mechanized on average
[22m[39m
  Infantry avg DPS/$1K:    1.96
  Mechanized avg DPS/$1K:  3.05
  Ratio (inf/mech):        0.64x

[90mstdout[2m | src/engine/__tests__/balance-report.test.ts[2m > [22m[2m§3 — Damage Scaling by Player Segment[2m > [22m[2mprints DPS comparison across all segments and divisions
[22m[39m
===== DPS BY PLAYER SEGMENT =====
┌─────────┬──────────────┬────────────┬──────────┬───────┬───────────┬───────────┐
│ (index) │ Division     │ New Player │ Mid-Tier │ Whale │ Whale/New │ Whale/Mid │
├─────────┼──────────────┼────────────┼──────────┼───────┼───────────┼───────────┤
│ 0       │ [32m'RECON     '[39m │ [33m26[39m         │ [33m39[39m       │ [33m84[39m    │ [32m'3.2x'[39m    │ [32m'2.2x'[39m    │
│ 1       │ [32m'ASSAULT   '[39m │ [33m78[39m         │ [33m127[39m      │ [33m256[39m   │ [32m'3.3x'[39m    │ [32m'2.0x'[39m    │
│ 2       │ [32m'SNIPER    '[39m │ [33m111[39m        │ [33m248[39m      │ [33m779[39m   │ [32m'7.0x'[39m    │ [32m'3.1x'[39m    │
│ 3       │ [32m'RPG       '[39m │ [33m97[39m         │ [33m186[39m      │ [33m464[39m   │ [32m'4.8x'[39m    │ [32m'2.5x'[39m    │
│ 4       │ [32m'JEEP      '[39m │ [33m58[39m         │ [33m100[39m      │ [33m233[39m   │ [32m'4.0x'[39m    │ [32m'2.3x'[39m    │
│ 5       │ [32m'TANK      '[39m │ [33m241[39m        │ [33m410[39m      │ [33m1067[39m  │ [32m'4.4x'[39m    │ [32m'2.6x'[39m    │
│ 6       │ [32m'JET       '[39m │ [33m172[39m        │ [33m428[39m      │ [33m1542[39m  │ [32m'9.0x'[39m    │ [32m'3.6x'[39m    │
│ 7       │ [32m'WARSHIP   '[39m │ [33m484[39m        │ [33m970[39m      │ [33m2773[39m  │ [32m'5.7x'[39m    │ [32m'2.9x'[39m    │
│ 8       │ [32m'SUBMARINE '[39m │ [33m877[39m        │ [33m1637[39m     │ [33m4599[39m  │ [32m'5.2x'[39m    │ [32m'2.8x'[39m    │
└─────────┴──────────────┴────────────┴──────────┴───────┴───────────┴───────────┘

[90mstdout[2m | src/engine/__tests__/balance-report.test.ts[2m > [22m[2m§3 — Damage Scaling by Player Segment[2m > [22m[2mwhale advantage per division is within 10× of new player
[22m[39m
  Whale/New Player advantage ratios:
    ✅ recon: 3.4x
    ✅ assault: 3.7x
    ✅ sniper: 6.8x
    ✅ rpg: 5.0x
    ✅ jeep: 4.2x
    ✅ tank: 4.6x
    ✅ jet: 8.6x
    ✅ warship: 5.7x
    ✅ submarine: 5.1x

[90mstdout[2m | src/engine/__tests__/balance-report.test.ts[2m > [22m[2m§4 — Full Battle Matchup Simulations[2m > [22m[2mInfantry Swarm vs Mechanized Elite
[22m[39m
===== MATCHUP: Infantry Swarm vs Mechanized Elite =====
  ATK (New Player): recon, recon, recon, assault, assault
    Army cost: $240.000
    Total damage: 3124
    Divs destroyed: 5
    Survivors: 0/5
  DEF (Mid-Tier): tank, tank, jet
    Army cost: $500.000
    Total damage: 23.752
    Divs destroyed: 0
    Survivors: 3/3
  RESULT: DEF WINS | Damage ratio: 0.13:1

[90mstdout[2m | src/engine/__tests__/balance-report.test.ts[2m > [22m[2m§4 — Full Battle Matchup Simulations[2m > [22m[2mMid-Tier Balanced vs Whale Fleet
[22m[39m
===== MATCHUP: Mid-Tier Balanced vs Whale Fleet =====
  ATK (Mid-Tier): assault, assault, rpg, sniper, tank
    Army cost: $450.000
    Total damage: 2640
    Divs destroyed: 5
    Survivors: 0/5
  DEF (Whale): submarine, submarine, warship, warship, jet
    Army cost: $1.300.000
    Total damage: 80.371
    Divs destroyed: 0
    Survivors: 5/5
  RESULT: DEF WINS | Damage ratio: 0.03:1

[90mstdout[2m | src/engine/__tests__/balance-report.test.ts[2m > [22m[2m§4 — Full Battle Matchup Simulations[2m > [22m[2mEqual Budget ($300k): Best Infantry vs Best Mech
[22m[39m
===== MATCHUP: Equal Budget ($300k): Best Infantry vs Best Mech =====
  ATK (Mid-Tier): rpg, rpg, rpg
    Army cost: $300.000
    Total damage: 10.559
    Divs destroyed: 3
    Survivors: 0/3
  DEF (Mid-Tier): tank, tank
    Army cost: $300.000
    Total damage: 25.743
    Divs destroyed: 0
    Survivors: 2/2
  RESULT: DEF WINS | Damage ratio: 0.41:1

[90mstdout[2m | src/engine/__tests__/balance-report.test.ts[2m > [22m[2m§4 — Full Battle Matchup Simulations[2m > [22m[2m3 Mid-Tiers vs 1 Whale (numbers advantage)
[22m[39m
===== MATCHUP: 3 Mid-Tiers vs 1 Whale (numbers advantage) =====
  ATK (Mid-Tier): assault, assault, assault, rpg, rpg, sniper, sniper, tank
    Army cost: $690.000
    Total damage: 6630
    Divs destroyed: 8
    Survivors: 0/8
  DEF (Whale): submarine, warship, jet, tank, jet
    Army cost: $1.100.000
    Total damage: 85.492
    Divs destroyed: 0
    Survivors: 5/5
  RESULT: DEF WINS | Damage ratio: 0.08:1

[90mstdout[2m | src/engine/__tests__/report.test.ts[2m > [22m[2mREPORT[2m > [22m[2mgenerates full report
[22m[39mReport written to: C:\Users\Usuario\Warx\xwar\report_results.md

 [32m✓[39m src/engine/__tests__/report.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 73[2mms[22m[39m
[90mstdout[2m | src/engine/__tests__/balance-report.test.ts[2m > [22m[2m§5 — Composite Balance Summary[2m > [22m[2mprints full balance scorecard
[22m[39m
╔══════════════════════════════════════════════════════╗
║        XWAR  30-DAY  BALANCE  SCORECARD             ║
╚══════════════════════════════════════════════════════╝

── DPS Ranking (Mid-Tier, 1000 ticks) ──
  1. submarine  ████████████████████     1667 DPT  ($300.000)
  2. warship    ████████████              936 DPT  ($250.000)
  3. jet        ██████                    452 DPT  ($200.000)
  4. tank       ██████                    428 DPT  ($150.000)
  5. sniper     ████                      252 DPT  ($80.000)
  6. rpg        ███                       173 DPT  ($100.000)
  7. assault    ██                        115 DPT  ($60.000)
  8. jeep       ██                         94 DPT  ($100.000)
  9. recon      █                          36 DPT  ($40.000)

── Cost Efficiency Outliers ──
  ✅ No severely overtuned divisions
  ✅ No severely undertuned divisions

── Whale Advantage Check ──
  ⚠️ Worst whale/new ratio: 9.2× on jet

── VERDICT ──
  ⚠️  1 issue(s) found:
    1. Whale advantage too high on jet: 9.2×


 [32m✓[39m src/engine/__tests__/balance-report.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 80[2mms[22m[39m
node.exe : 
En línea: 1 Carácter: 1
+ & "C:\Program 
Files\nodejs/node.exe" "C:\Program 
Files\nodejs/node_mo ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~
    + CategoryInfo          : NotS 
   pecified: (:String) [], Remote  
  Exception
    + FullyQualifiedErrorId : Nati 
   veCommandError
 
[31m⎯⎯⎯⎯⎯⎯⎯[39m[1m[41m Failed 
Tests 1 [49m[22m[31m⎯⎯⎯⎯⎯⎯⎯[39m

[41m[1m FAIL [22m[49m src/engin
e/__tests__/elections.test.ts[2m 
> [22maggregateContributions[2m 
> [22mexcludes entries outside 
the rolling window
[31m[1mAssertionError[22m: 
expected 10999 to be 1000 // 
Object.is equality[39m

[32m- Expected[39m
[31m+ Received[39m

[32m- 1000[39m
[31m+ 10999[39m

[36m [2m❯[22m src/engine/__tests
__/elections.test.ts:[2m318:27[22
m[39m
    [90m316|[39m     ]
    [90m317|[39m     
[35mconst[39m result [33m=[39m 
[34maggregateContributions[39m(en
tries[33m,[39m now)
    [90m318|[39m     [34mexpect
[39m(result[33m.[39mdamage)[33m.
[39m[34mtoBe[39m([34m1000[39m)
    [90m   |[39m                 
          [31m^[39m
    [90m319|[39m   })
    [90m320|[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1
/1]⎯[22m[39m


[2m Test Files [22m [1m[31m1 failed[39m[22m[2m | [22m[1m[32m5 passed[39m[22m[90m (6)[39m
[2m      Tests [22m [1m[31m1 failed[39m[22m[2m | [22m[1m[32m109 passed[39m[22m[90m (110)[39m
[2m   Start at [22m 00:54:33
[2m   Duration [22m 1.94s[2m (transform 1.39s, setup 0ms, import 2.05s, tests 218ms, environment 7.41s)[22m

