import { Command } from "commander"
import { getAvailableActions, runAction } from "./dataset/index.js"

const DEFAULT_OUTPUT_DIR = 'output'
const DEFAULT_MAX_COMMITS = Number.MAX_SAFE_INTEGER

const program = new Command()

program
  .name('merge-mining')
  .description('Helpers for reproducing merge commits from GitHub repositories with different merge tools')

program
  .command('dataset')
  .description('Mine GitHub repositories and build dataset')
  .argument('<action>', `action to run. Must be one of: ${JSON.stringify(getAvailableActions())}`)
  .argument('<inputFile>', 'path to the input CSV file')
  .option('-o, --output <path>', `path to the output directory. Defaults to: ${DEFAULT_OUTPUT_DIR}`, DEFAULT_OUTPUT_DIR)
  .option('-s, --since <date>', 'process merge commits starting from this date')
  .option('-u, --until <date>', 'process merge commits up to this date')
  .option('-r, --random-seed <seed>', 'random seed for shuffling merge commits deterministically', Number)
  .option(
    '-m, --max-commits <commits>',
    'maximum number of processed merge commits',
    Number,
    DEFAULT_MAX_COMMITS
  )
  .option(
    '-e, --extensions <extensions>',
    'comma-separated list of file extensions to be processed',
    extensions => extensions.split(','),
    []
  )
  .action(runAction)

program.parse()
