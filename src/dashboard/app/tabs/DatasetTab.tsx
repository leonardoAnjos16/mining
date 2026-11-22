import { CsvTitle, DataTable } from '../components/DataTable'

export const DatasetTab = () => <>
  <p className="description">All files in the experiment, regardless of the selected files and scope. A scenario is a merge commit.</p>
  <CsvTitle title="Per language" file="language-counts.csv" />
  <DataTable file="language-counts.csv" />
  <CsvTitle title="Per project" file="project-counts.csv" />
  <DataTable file="project-counts.csv" />
</>
