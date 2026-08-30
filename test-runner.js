/**
 * Automated billing-engine test runner (P10).
 * Reads docs/P10_prepaid_meter_public.json, runs every case, writes docs/test_report.json.
 *
 *   npm run test:engine
 *   npx tsx test-runner.js
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  calculateEnergyCost,
  calendarMonthKey,
  compareHabits,
  DEMAND_CHARGE,
  METER_RENT,
  runPredictions,
  runSimulation,
  VAT_MULTIPLIER,
} from './src/billingEngine.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const inputPath = path.join(__dirname, 'docs', 'P10_prepaid_meter_public.json')
const outputPath = path.join(__dirname, 'docs', 'test_report.json')

const FIXED = METER_RENT + DEMAND_CHARGE
const EPS = 1e-6

function almost(a, b, eps = EPS) {
  return Math.abs(a - b) <= eps
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
    if (!almost(point.vat, point.rawEnergyCost * VAT_MULTIPLIER, 0.015)) {
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
    if (!almost(predictions.breakdown.vat, predictions.breakdown.energy * VAT_MULTIPLIER, 0.02)) {
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

  if (comparison) {
    const steps = Math.round(comparison.difference / FIXED)
    const reconstructed = parseFloat((steps * FIXED).toFixed(2))
    if (!almost(comparison.difference, reconstructed, 0.02)) {
      issues.push(
        `Habit cost difference ${comparison.difference} is not a multiple of ${FIXED} (energy should be identical).`,
      )
    }
  }

  return issues
}

console.log('Starting automated test runner...')

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
    console.log(`Processing ${testCase.case_id}...`)

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
  console.log(`Unit checks: ${unit_checks.passed} passed, ${unit_checks.failed} failed`)
  console.log(`Cases: ${report.summary.passed} passed, ${report.summary.failed} failed`)
  console.log(`Report saved to: ${outputPath}`)

  if (unit_checks.failed > 0 || report.summary.failed > 0) {
    process.exitCode = 1
  }
} catch (error) {
  console.error('Test runner failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
