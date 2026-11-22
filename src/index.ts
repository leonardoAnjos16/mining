import { Command } from "commander"
import { getAvailableActions, runAction } from "./dataset/index.js"
import { runMerge } from "./merge.js"
import { getAvailableTools } from "./utils/tools/index.js"
import { runExperiment } from "./experiment.js"
import { computeMetrics } from "./analysis/index.js"
import { runCases } from "./analysis/cases/index.js"
import { checkCases } from "./analysis/cases/check.js"

export type Repo = {
  name: string
  path: string
  language: string
}

export type MergeScenarioFile = {
  baseCommit: string
  leftCommit: string
  rightCommit: string
  mergeCommit: string
  filepath: string
}

const DEFAULT_OUTPUT_DIR = 'output'
const DEFAULT_MAX_REPOS = 20
const DEFAULT_MAX_COMMITS = Number.MAX_SAFE_INTEGER
const DEFAULT_REPEAT = 1
const DEFAULT_CASES_PER_GROUP = 10
const DEFAULT_CASES_SEED = 1
const DEFAULT_DASHBOARD_PORT = 5173

const program = new Command()

program
  .name('merge-mining')
  .description('Helpers for reproducing merge commits from GitHub repositories with different merge tools')

program
  .command('dataset')
  .description('Mine GitHub repositories and build dataset')
  .argument('<action>', `action to run. Must be one of: ${JSON.stringify(getAvailableActions())}`)
  .option('-o, --output <path>', 'path to the output directory', DEFAULT_OUTPUT_DIR)
  .option('-s, --since <date>', 'process merge commits starting from this date')
  .option('-u, --until <date>', 'process merge commits up to this date')
  .option('-r, --random-seed <seed>', 'random seed for shuffling merge commits deterministically', Number)
  .option(
    '-t, --max-repos <repos>',
    'maximum number of processed repos per language',
    Number,
    DEFAULT_MAX_REPOS
  )
  .option(
    '-c, --max-commits <commits>',
    'maximum number of processed merge commits',
    Number,
    DEFAULT_MAX_COMMITS
  )
  .option(
    '-l, --languages <languages>',
    'comma-separated list of programming languages to consider',
    languages => languages.split(','),
    []
  )
  .action(runAction)

program
  .command('merge')
  .description('Run merge tools for the versions of one file in a merge commit')
  .argument(
    '<tools>',
    `comma-separated list of merge tools to run. Availables tools are: ${JSON.stringify(getAvailableTools())}`,
    tools => tools.split(',')
  )
  .argument('<project-path>', 'path to the project in which the merge tool will run')
  .argument('<merge-commit>', 'hash of the merge commit in which the merge tool will run')
  .argument('<filepath>', 'path to the file in which the merge tool will run')
  .option('-o, --output <path>', 'path to the ouput directory', DEFAULT_OUTPUT_DIR)
  .option('-a, --alias <alias>', 'name of the directory in which the versions of the file will be saved')
  .action(runMerge)

program
  .command('experiment')
  .description('Run merge experiment with multiple tools for a list of file revisions')
  .argument('<input-file>', 'path to the input CSV file')
  .argument('<projects-path>', 'path to the cloned repositories of projects in input file')
  .argument('<files-path>', 'path to the CSV files listing the files to be merged from each project')
  .argument(
    '<tools>',
    `comma-separated list of merge tools to run. Available tools are: ${JSON.stringify(getAvailableTools())}`,
    tools => tools.split(',')
  )
  .option('-o, --output <path>', 'path to the output directory', DEFAULT_OUTPUT_DIR)
  .option('-a, --alias <alias>', 'name of the directory in which the results will be saved')
  .option(
    '-r, --repeat <times>',
    'number of times each tool should run for timing purposes',
    Number,
    DEFAULT_REPEAT
  )
  .option('--resume', 'continue the run saved under --alias, skipping scenarios that already have results')
  .action(runExperiment)

const analysis = program
  .command('analysis')
  .description('Analyse merge experiment results')

analysis
  .command('metrics')
  .description('Compute metrics from the results of a merge experiment')
  .argument('<results-path>', 'path to the CSV files containing the results of the merge experiment')
  .option('-o, --output <path>', 'path to the output directory', DEFAULT_OUTPUT_DIR)
  .option('-a, --alias <alias>', 'name of the directory in which the analysis will be saved')
  .action(computeMetrics)

analysis
  .command('cases')
  .description('Select AFP, AFN and clean-but-different cases, re-run their merges and save them for annotation')
  .argument('<results-path>', 'path to the CSV files containing the results of the merge experiment')
  .argument('<projects-path>', 'path to the cloned repositories of the projects in the results')
  .requiredOption('-a, --alias <alias>', 'name of the analysis directory in which the cases will be saved')
  .option('-o, --output <path>', 'path to the output directory', DEFAULT_OUTPUT_DIR)
  .option('-n, --per-group <cases>', 'number of cases selected per pair and metric, and per tool', Number, DEFAULT_CASES_PER_GROUP)
  .option('-s, --seed <seed>', 'random seed for selecting cases', Number, DEFAULT_CASES_SEED)
  .action(runCases)

analysis
  .command('check')
  .description('Validate the labels and case annotations of an analysis, and list the cases left to annotate')
  .argument('<alias>', 'name of the analysis directory, as given to "analysis cases"')
  .option('-o, --output <path>', 'path to the output directory', DEFAULT_OUTPUT_DIR)
  .option('-g, --group <group>', 'list only the cases to annotate in this group (e.g. afp/diff3/mergiraf), in selection order')
  .action(checkCases)

const dashboard = program
  .command('dashboard')
  .description('Show the results of an analysis in the browser')

dashboard
  .command('serve')
  .description('Serve the dashboard, reading results, cases, annotations and labels live')
  .argument('<alias>', 'name of the analysis directory')
  .option('-o, --output <path>', 'path to the output directory', DEFAULT_OUTPUT_DIR)
  .option('-p, --port <port>', 'port to listen on', Number, DEFAULT_DASHBOARD_PORT)
  .action(async (alias, options) => (await import('./dashboard/server.js')).serveDashboard(alias, options))

dashboard
  .command('export')
  .description('Write a static copy of the dashboard into the analysis directory, to open from disk or share as a folder')
  .argument('<alias>', 'name of the analysis directory')
  .option('-o, --output <path>', 'path to the output directory', DEFAULT_OUTPUT_DIR)
  .action(async (alias, options) => (await import('./dashboard/export.js')).exportDashboard(alias, options))

program.parse()
