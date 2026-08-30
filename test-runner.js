/**
 * Automated billing-engine test runner (P10).
 * Reads docs/P10_prepaid_meter_public.json, runs every case, prints a pass/fail
 * report in the terminal, and writes docs/test_report.json.
 *
 *   npm test
 *   npm run test:engine
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  adviseClosedShopRecharge,
  calculateEnergyCost,
  calendarMonthKey,
  compareHabits,
  daysUntilNextSlab,
  FIXED_CHARGES,
  getSlabPosition,
  roundTaka,
  runPredictions,
  runSimulation,
  VAT_RATE,
} from './src/billingEngine.ts'
import { buildFamilyPlanText } from './src/familyPlan.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const inputPath = path.join(__dirname, 'docs', 'P10_prepaid_meter_public.json')
const outputPath = path.join(__dirname, 'docs', 'test_report.json')

const FIXED = FIXED_CHARGES
const EPS = 1e-6

function almost(a, b, eps = EPS) {
  return Math.abs(a - b) <= eps
}

function expectedHabitEnergyVat(days, months, dailyUnits) {
  const constantUnits =
    typeof dailyUnits === 'number' && Number.isFinite(dailyUnits) ? dailyUnits : null
  let total = 0
  let currentMonth = null
  let monthRunningUnits = 0

  days
    .filter((day) => months.includes(day.date.substring(0, 7)))
    .forEach((day) => {
      const units = constantUnits === null ? day.units : constantUnits
      const monthKey = calendarMonthKey(day.date)
      if (currentMonth !== monthKey) {
        currentMonth = monthKey
        monthRunningUnits = 0
      }
      const energy = calculateEnergyCost(units, monthRunningUnits)
      const vat = roundTaka(energy * VAT_RATE)
      total = roundTaka(total + roundTaka(energy + vat))
      monthRunningUnits += units
    })

  return total
}

function runUnitChecks() {
  const checks = [
    {
      name: 'slab1_only',
      pass: almost(calculateEnergyCost(5, 0), 5 * 4.63),
      detail: `${calculateEnergyCost(5, 0)} === ${5 * 4.63}`,
    },
    {
      name: 'cross_75',
      pass: almost(calculateEnergyCost(10, 70), 5 * 4.63 + 5 * 5.26),
      detail: '70 + 10 units splits 5 @ 4.63 and 5 @ 5.26',
    },
    {
      name: 'start_of_slab2',
      pass: almost(calculateEnergyCost(1, 75), 1 * 5.26),
      detail: 'counter already at 75 bills the next unit at 5.26',
    },
    {
      name: 'cross_200',
      pass: almost(calculateEnergyCost(10, 195), 5 * 5.26 + 5 * 5.63),
      detail: '195 + 10 units splits across 200 boundary',
    },
    {
      name: 'habits_cost_excludes_deposits_and_can_tie',
      pass: (() => {
        const result = compareHabits(
          [
            { date: '2026-01-01', units: 5 },
            { date: '2026-01-02', units: 5 },
          ],
          {
            months: ['2026-01'],
            opening_balance_bdt: '0.00',
            low_threshold_bdt: '100.00',
            low_amount_bdt: '2000.00',
            monthly_amount_bdt: '2000.00',
          },
        )
        return (
          result.winner === 'Tie' &&
          almost(result.difference, 0) &&
          almost(result.lowBalanceCost, result.monthlyCost) &&
          result.lowBalanceCost < 2000 &&
          almost(result.lowBalanceFixedCharges, FIXED) &&
          almost(result.monthlyFixedCharges, FIXED)
        )
      })(),
      detail: 'Same units → same energy; cost is energy+VAT+82, not the 2000 deposit',
    },
    {
      name: 'habits_low_balance_can_skip_a_month_of_82',
      pass: (() => {
        const result = compareHabits(
          [
            { date: '2026-01-01', units: 1 },
            { date: '2026-01-02', units: 1 },
          ],
          {
            months: ['2026-01'],
            opening_balance_bdt: '5000.00',
            low_threshold_bdt: '100.00',
            low_amount_bdt: '2000.00',
            monthly_amount_bdt: '2000.00',
          },
        )
        return (
          result.winner === 'Low Balance' &&
          almost(result.difference, FIXED) &&
          almost(result.lowBalanceFixedCharges, 0) &&
          almost(result.monthlyFixedCharges, FIXED) &&
          almost(result.lowBalanceCost, result.energyAndVat) &&
          almost(result.monthlyCost, result.energyAndVat + FIXED)
        )
      })(),
      detail: 'High opening balance never trips the threshold; monthly still pays 82 on the 1st',
    },
    {
      name: 'slab_headroom_before_75',
      pass: (() => {
        const slab = getSlabPosition(70)
        return (
          almost(slab.currentRate, 4.63) &&
          almost(slab.unitsLeftInSlab, 5) &&
          almost(slab.nextRate, 5.26) &&
          daysUntilNextSlab(5, 2) === 3
        )
      })(),
      detail: '70 units this month → 5 units left at 4.63, then 5.26',
    },
    {
      name: 'slab_headroom_after_exactly_75',
      pass: (() => {
        const slab = getSlabPosition(75)
        return almost(slab.currentRate, 5.26) && almost(slab.unitsLeftInSlab, 125)
      })(),
      detail: 'After 75 units the next unit is already slab 2',
    },
    {
      name: 'friday_shop_closure_advice',
      pass: (() => {
        const friday = adviseClosedShopRecharge('2026-07-03')
        const thursday = adviseClosedShopRecharge('2026-07-02')
        return (
          friday.weekday === 'Friday' &&
          friday.shopsLikelyClosed &&
          friday.rechargeByDate === '2026-07-02' &&
          friday.coverUntilDate === '2026-07-05' &&
          thursday.shopsLikelyClosed === false
        )
      })(),
      detail: '2026-07-03 is Friday; recharge by Thursday and cover through Sunday',
    },
    {
      name: 'family_plan_text_is_plain',
      pass: (() => {
        const text = buildFamilyPlanText({
          generatedOn: '2026-06-30',
          monthCount: 6,
          lightMonth: 'January 2026',
          lightUnits: 1,
          heavyMonth: 'May 2026',
          heavyUnits: 2,
          lastWeekRecharge: '5000.00 BDT on 2026-06-28',
          todayBalance: 100,
          usualDailyUnits: 14,
          runOutDate: '2026-07-03',
          targetDate: '2026-07-25',
          amountNeededToday: 10,
          breakdown: { energy: 8, vat: 0.4, fixedCharges: 0, slabPenalty: 1 },
          habitWinner: 'Tie',
          habitDifference: 0,
          lowBalanceCost: 1,
          monthlyCost: 1,
          slab: getSlabPosition(70),
          daysUntilNextSlab: 3,
          shop: adviseClosedShopRecharge('2026-07-03'),
          weekendCoverAmount: 20,
        })
        return (
          text.includes('Stay-on plan') &&
          text.includes('Recharge by 2026-07-02') &&
          !text.includes('<')
        )
      })(),
      detail: 'Downloaded plan is plain text with slab and Friday advice',
    },
  ]
  return {
    passed: checks.filter((c) => c.pass).length,
    failed: checks.filter((c) => !c.pass).length,
    checks,
  }
}

function collectCaseIssues(testCase, simulationResult, predictions, comparison) {
  const issues = []
  const history = simulationResult.history

  if (!history.length) {
    issues.push('Simulation produced empty history.')
    return issues
  }

  history.forEach((point) => {
    if (!almost(point.vat, point.rawEnergyCost * VAT_RATE, 0.015)) {
      issues.push(`VAT mismatch on ${point.date}: ${point.vat} vs 5% of ${point.rawEnergyCost}`)
    }
    if (point.fixedChargesTaken !== 0 && !almost(point.fixedChargesTaken, FIXED)) {
      issues.push(`Unexpected fixed charges on ${point.date}: ${point.fixedChargesTaken}`)
    }
    if (point.date.endsWith('-01') && point.monthRunningUnits !== point.units) {
      issues.push(
        `Slab counter did not reset on ${point.date}: running=${point.monthRunningUnits} units=${point.units}`,
      )
    }
  })

  const byDate = new Map()
  testCase.recharges.forEach((recharge) => {
    const prev = byDate.get(recharge.date) ?? 0
    byDate.set(recharge.date, prev + parseFloat(String(recharge.amount_bdt)))
  })
  byDate.forEach((amount, date) => {
    const point = history.find((row) => row.date === date)
    if (!point) {
      issues.push(`Recharge on ${date} has no history row.`)
      return
    }
    if (point.rechargeAmount === null || !almost(point.rechargeAmount, amount, 0.01)) {
      issues.push(
        `Recharge marker mismatch on ${date}: history=${point.rechargeAmount} json=${amount}`,
      )
    }
  })

  const monthsWithFixed = new Set()
  history.forEach((point) => {
    if (point.fixedChargesTaken > 0) {
      const key = point.date.substring(0, 7)
      if (monthsWithFixed.has(key)) {
        issues.push(`Fixed charges taken more than once in ${key}.`)
      }
      monthsWithFixed.add(key)
    }
  })

  if (predictions) {
    if (!almost(predictions.breakdown.vat, predictions.breakdown.energy * VAT_RATE, 0.02)) {
      issues.push(
        `Prediction VAT is not 5% of energy: vat=${predictions.breakdown.vat} energy=${predictions.breakdown.energy}`,
      )
    }
    const fixed = predictions.breakdown.fixedCharges
    if (fixed !== 0 && !almost(fixed, FIXED, 0.01)) {
      issues.push(`Prediction fixed charges must be 0 or ${FIXED}, got ${fixed}`)
    }

    const today = testCase.today
    const paidThisMonth = history
      .filter((row) => row.date.substring(0, 7) === today.substring(0, 7))
      .some((row) => row.fixedChargesTaken > 0)

    if (paidThisMonth && !almost(fixed, 0, 0.01)) {
      issues.push(
        `Already recharged this month; target breakdown should show 0 fixed charges, got ${fixed}`,
      )
    }
    if (!paidThisMonth && !almost(fixed, FIXED, 0.01)) {
      issues.push(
        `No recharge yet this month; target breakdown should include ${FIXED} fixed charges, got ${fixed}`,
      )
    }
  }

  if (comparison && testCase.comparison) {
    const months = testCase.comparison.months
    const dailyUnits = testCase.comparison.daily_units
    const expectedEnergyVat = expectedHabitEnergyVat(testCase.days, months, dailyUnits)

    if (!almost(comparison.energyAndVat, expectedEnergyVat, 0.05)) {
      issues.push(
        `Habit energy+VAT ${comparison.energyAndVat} does not match independent rebuild ${expectedEnergyVat}`,
      )
    }
    if (!almost(comparison.lowBalanceCost, comparison.energyAndVat + comparison.lowBalanceFixedCharges, 0.02)) {
      issues.push(
        `Low-balance cost ${comparison.lowBalanceCost} is not energy+VAT plus fixed charges`,
      )
    }
    if (!almost(comparison.monthlyCost, comparison.energyAndVat + comparison.monthlyFixedCharges, 0.02)) {
      issues.push(
        `Monthly cost ${comparison.monthlyCost} is not energy+VAT plus fixed charges`,
      )
    }

    const expectedDiff = roundTaka(
      Math.abs(comparison.lowBalanceFixedCharges - comparison.monthlyFixedCharges),
    )
    if (!almost(comparison.difference, expectedDiff, 0.02)) {
      issues.push(
        `Habit difference ${comparison.difference} is not the gap in ৳82 counts (${expectedDiff})`,
      )
    }

    const steps = Math.round(comparison.difference / FIXED)
    const reconstructed = parseFloat((steps * FIXED).toFixed(2))
    if (!almost(comparison.difference, reconstructed, 0.02)) {
      issues.push(
        `Habit cost difference ${comparison.difference} is not a multiple of ${FIXED} (energy should be identical).`,
      )
    }

    if (almost(comparison.difference, 0, 0.02) && comparison.winner !== 'Tie') {
      issues.push(`Equal billed costs should be a Tie, got ${comparison.winner}`)
    }
    if (comparison.lowBalanceCost < comparison.monthlyCost - 0.02 && comparison.winner !== 'Low Balance') {
      issues.push(`Low-balance is cheaper but winner is ${comparison.winner}`)
    }
    if (comparison.monthlyCost < comparison.lowBalanceCost - 0.02 && comparison.winner !== 'Monthly') {
      issues.push(`Monthly is cheaper but winner is ${comparison.winner}`)
    }
  }

  return issues
}

function mark(pass) {
  return pass ? 'PASS' : 'FAIL'
}

function printReport(report) {
  const line = '='.repeat(64)
  const thin = '-'.repeat(64)
  console.log('')
  console.log(line)
  console.log('MeterWise billing engine — test report')
  console.log(line)
  console.log(`Generated: ${report.generated_at}`)
  console.log('')
  console.log('Unit checks')
  console.log(thin)
  report.unit_checks.checks.forEach((check) => {
    console.log(`  ${mark(check.pass).padEnd(4)}  ${check.name}`)
    if (!check.pass) console.log(`          ${check.detail}`)
  })
  console.log(
    `  ${report.unit_checks.passed} passed, ${report.unit_checks.failed} failed (${report.unit_checks.checks.length} total)`,
  )
  console.log('')
  console.log('Public cases')
  console.log(thin)
  report.results.forEach((result) => {
    const label = result.status === 'SUCCESS' ? 'PASS' : result.status
    console.log(`  ${label.padEnd(7)}  ${result.case_id}`)
    if (result.status !== 'SUCCESS' && result.issues?.length) {
      result.issues.forEach((issue) => console.log(`          - ${issue}`))
    }
  })
  console.log(
    `  ${report.summary.passed} passed, ${report.summary.failed} failed (${report.total_cases_run} total)`,
  )
  console.log('')
  console.log('Summary')
  console.log(thin)
  const unitTotal = report.unit_checks.checks.length
  const caseTotal = report.total_cases_run
  const allPassed = report.unit_checks.failed === 0 && report.summary.failed === 0
  console.log(
    `  Unit checks : ${report.unit_checks.passed}/${unitTotal} passed`,
  )
  console.log(`  Public cases: ${report.summary.passed}/${caseTotal} passed`)
  if (report.summary.failed > 0) {
    const failedIds = report.results
      .filter((row) => row.status !== 'SUCCESS')
      .map((row) => row.case_id)
      .join(', ')
    console.log(`  Failed cases: ${failedIds}`)
  }
  console.log(`  Overall     : ${allPassed ? 'ALL PASSED' : 'FAILED'}`)
  console.log(`  JSON report : ${outputPath}`)
  console.log(line)
  console.log('')
}

if (!fs.existsSync(inputPath)) {
  console.error('Missing published fixture:')
  console.error(`  ${inputPath}`)
  console.error('Copy P10_prepaid_meter_public.json from the problem pack into docs/ then run:')
  console.error('  npm test')
  process.exit(1)
}

console.log('Running MeterWise engine tests...')

try {
  const rawData = fs.readFileSync(inputPath, 'utf8')
  const testData = JSON.parse(rawData)

  if (!testData.cases || !Array.isArray(testData.cases)) {
    throw new Error('Invalid JSON structure: Missing "cases" array.')
  }

  const unit_checks = runUnitChecks()
  const report = {
    generated_at: new Date().toISOString(),
    total_cases_run: testData.cases.length,
    unit_checks,
    summary: { passed: 0, failed: 0 },
    results: [],
  }

  testData.cases.forEach((testCase) => {

    try {
      const simulationResult = runSimulation(
        testCase.days,
        testCase.recharges,
        testCase.opening_balance_bdt,
      )

      const todayState =
        simulationResult.history.find((row) => row.date === testCase.today) ||
        simulationResult.history[simulationResult.history.length - 1]

      const paidThisMonth = simulationResult.history
        .filter((row) => row.date.substring(0, 7) === todayState.date.substring(0, 7))
        .some((row) => row.fixedChargesTaken > 0)

      const predictionState = {
        balance: todayState.balance,
        date: todayState.date,
        currentMonth: calendarMonthKey(todayState.date),
        monthRunningUnits: todayState.monthRunningUnits,
        hasPaidFixedChargesThisMonth: paidThisMonth,
      }

      const predictions = runPredictions(
        predictionState,
        testCase.usual_daily_units,
        testCase.target_date,
      )

      const comparison = testCase.comparison
        ? compareHabits(testCase.days, testCase.comparison)
        : null

      const issues = collectCaseIssues(testCase, simulationResult, predictions, comparison)
      const status = issues.length === 0 ? 'SUCCESS' : 'FAIL'
      if (status === 'SUCCESS') report.summary.passed += 1
      else report.summary.failed += 1

      report.results.push({
        case_id: testCase.case_id,
        status,
        issues,
        outputs: {
          simulation_final_balance: Number(simulationResult.finalBalance.toFixed(2)),
          today_balance: todayState.balance,
          today_month_running_units: todayState.monthRunningUnits,
          recharges_in_today_month: paidThisMonth,
          prediction_run_out_date: predictions.runOutDate || 'Did not run out',
          prediction_target_amount_bdt: predictions.amountNeededToday,
          prediction_breakdown: predictions.breakdown,
          comparison_winner: comparison ? comparison.winner : 'N/A',
          comparison_low_balance_cost: comparison ? comparison.lowBalanceCost : 'N/A',
          comparison_monthly_cost: comparison ? comparison.monthlyCost : 'N/A',
          comparison_cost_difference: comparison ? comparison.difference : 'N/A',
          comparison_energy_and_vat: comparison ? comparison.energyAndVat : 'N/A',
          comparison_low_fixed: comparison ? comparison.lowBalanceFixedCharges : 'N/A',
          comparison_monthly_fixed: comparison ? comparison.monthlyFixedCharges : 'N/A',
        },
      })
    } catch (error) {
      report.summary.failed += 1
      report.results.push({
        case_id: testCase.case_id ?? 'UNKNOWN',
        status: 'ERROR',
        issues: [error instanceof Error ? error.message : String(error)],
        outputs: null,
      })
    }
  })

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2))
  printReport(report)

  if (unit_checks.failed > 0 || report.summary.failed > 0) {
    process.exitCode = 1
  }
} catch (error) {
  console.error('Test runner failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
