import * as Plot from '@observablehq/plot'
import { JSDOM } from 'jsdom'
import { writeFile } from '../utils/file.js'
import { ToolResult } from '../experiment.js'
import path from 'path'

type TimeMeasurement = {
  tool: string
  mean: number
}

const computeMeans = (toolResults: ToolResult[]) => {
  const means: TimeMeasurement[] = []
  toolResults.forEach(({ tool, timeMeasurements }) => {
    if (timeMeasurements.length <= 2) {
      console.error(`Could not compute mean for ${tool}`)
      return
    }

    const sum = timeMeasurements.reduce((p, v) => p + v, 0)
    const min = Math.min(...timeMeasurements)
    const max = Math.max(...timeMeasurements)

    const mean = (sum - min - max) / (timeMeasurements.length - 2)
    means.push({ tool, mean })
  })

  return means
}

export const createBoxPlot = (toolResults: ToolResult[], outputDir: string) => {
  const data = computeMeans(toolResults)

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