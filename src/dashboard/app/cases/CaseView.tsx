import type { CaseGroup, CaseSummary } from '../../../analysis/cases/types'
import { Badge } from '../components/Badge'
import { CaseGrids } from './CaseGrids'
import { AnnotationErrors, AnnotationFile, Breadcrumb, Outcomes, type Origin } from './CaseHeader'

export const CaseView = ({ info, group, origin }: { info: CaseSummary, group?: CaseGroup, origin: Origin }) => {
  const { annotation } = info
  return <>
    <Breadcrumb info={info} origin={origin} />
    <h2>{info.project} · {info.filepath} <Badge className={`status-${info.status}`}>{info.status}</Badge></h2>
    <p className="description">
      Merge commit {info.mergeCommit} · {info.language}
      {!info.reproduced && ` · not reproduced by: ${info.mismatches.join(', ')}`}
      {annotation && ` · annotated by ${annotation.annotator} on ${annotation.date}${annotation.reviewed ? ', reviewed by you' : ', not reviewed'}`}
    </p>
    <AnnotationFile info={info} />
    <AnnotationErrors info={info} />
    <Outcomes info={info} currentGroup={group} />
    <CaseGrids key={info.id} info={info} group={group} />
  </>
}
