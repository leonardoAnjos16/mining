import * as Plot from '@observablehq/plot'
import { JSDOM } from 'jsdom'
import { writeFile } from '../utils/file.js'
import { Scenario } from './load.js'
import path from 'path'

type TimeMeasurement = {
  tool: string
  mean: number
}

const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length

const trimmedMean = (values: number[]) => {
  const sum = values.reduce((total, value) => total + value, 0)
  return (sum - Math.min(...values) - Math.max(...values)) / (values.length - 2)
}

const AGGREGATIONS = [
  { name: 'all', minMeasurements: 1, aggregate: mean },
  { name: 'without-first', minMeasurements: 2, aggregate: (values: number[]) => mean(values.slice(1)) },
  { name: 'trimmed', minMeasurements: 3, aggregate: trimmedMean }
]

const computeMeans = (scenarios: Scenario[], { minMeasurements, aggregate }: (typeof AGGREGATIONS)[number]) => {
  const means: TimeMeasurement[] = []
  let skipped = 0

  scenarios.forEach(({ tools }) => {
    Object.entries(tools).forEach(([tool, { timeMeasurements }]) => {
      if (timeMeasurements.length < minMeasurements) {
        skipped++
        return
      }

      means.push({ tool, mean: aggregate(timeMeasurements) })
    })
  })

  return { means, skipped }
}

const plotMeans = (data: TimeMeasurement[]) => {
  const { document } = new JSDOM().window
  const plot = Plot.plot({
    document,

    width: 1920,
    height: 1080,
    marginLeft: 200,

    x: {
      grid: true,
      type: 'log',
      label: "Time (ms)"
    },
    y: {
      label: 'Tool'
    },

    marks: [
      Plot.boxX(data, {
        x: 'mean',
        y: 'tool',
        r: 1,
      })
    ]
  })

  plot.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  plot.insertAdjacentHTML(
    'afterbegin',
    '<rect width="100%" height="100%" fill="white"/>'
  )

  return plot.outerHTML
}

export const createBoxPlots = (scenarios: Scenario[], outputDir: string) => {
  AGGREGATIONS.forEach(aggregation => {
    const filepath = path.join(outputDir, `boxplot-${aggregation.name}.svg`)
    const { means, skipped } = computeMeans(scenarios, aggregation)

    if (skipped > 0) {
      console.error(`${filepath}: skipped ${skipped} results with fewer than ${aggregation.minMeasurements} time measurements`)
    }

    writeFile(filepath, plotMeans(means))
  })
}
