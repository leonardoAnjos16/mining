import { Command } from "commander"
import { getAvailableActions, runAction } from "./dataset/index.js"
import { runTool } from "./merge/index.js"
import { getAvailableTools } from "./utils/tools/index.js"

export type Repo = {
  name: string
  path: string
}

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
  .argument('<input-file>', 'path to the input CSV file')
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

program
  .command('merge')
  .description('Run merge tool for the versions of one file in a merge commit')
  .argument(
    '<tools>',
    `comma-separated list of merge tools to run. Availables tools are: ${JSON.stringify(getAvailableTools())}`,
    tools => tools.split(',')
  )
  .argument('<project-path>', 'path to the project in which the merge tool will run')
  .argument('<merge-commit>', 'hash of the merge commit in which the merge tool will run')
  .argument('<filepath>', 'path to the file in which the merge tool will run')
  .option('-o, --output <path>', `path to the ouput directory. Defaults to: ${DEFAULT_OUTPUT_DIR}`, DEFAULT_OUTPUT_DIR)
  .option('-a, --alias <alias>', 'name of the directory in which the versions of the file will be saved')
  .action(runTool)

program.parse()
