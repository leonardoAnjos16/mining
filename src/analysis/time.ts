import * as Plot from '@observablehq/plot'
import { JSDOM } from 'jsdom'
import { writeFile } from '../utils/file.js'
import { Scenario } from './load.js'
import path from 'path'

type TimeMeasurement = {
  tool: string
  mean: number
}

const trimmedMean = (values: number[]) => {
  const sum = values.reduce((total, value) => total + value, 0)
  return (sum - Math.min(...values) - Math.max(...values)) / (values.length - 2)
}

const computeMeans = (scenarios: Scenario[]) => {
  const means: TimeMeasurement[] = []
  scenarios.forEach(({ tools }) => {
    Object.entries(tools).forEach(([tool, { timeMeasurements }]) => {
      if (timeMeasurements.length <= 2) {
        console.error(`Could not compute mean for ${tool}`)
        return
      }

      means.push({ tool, mean: trimmedMean(timeMeasurements) })
    })
  })

  return means
}

export const createBoxPlot = (scenarios: Scenario[], outputDir: string) => {
  const data = computeMeans(scenarios)

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

  plot.insertAdjacentHTML(
    'afterbegin',
    '<rect width="100%" height="100%" fill="white"/>'
  )

  const filepath = path.join(outputDir, 'boxplot.svg')
  writeFile(filepath, plot.outerHTML)
}