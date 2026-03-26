type InsightType = 'risk' | 'opportunity' | 'coach' | 'anomaly'
type InsightScope = 'TEAM' | 'MANAGER'

export type NormalizedAIInsight = {
  id: string
  scope: InsightScope
  type: InsightType
  title: string
  summary: string
  why: string
  recommended_actions: string[]
  prompt_version?: string
  provider?: string
  model?: string
  impact_estimate_rub?: number
  confidence?: number
  related_manager_ids?: string[]
  related_metrics?: string[]
  managerId?: string
}

type RawInsightRecord = {
  id: string
  scope: string
  type: string
  title: string
  summary: string
  why: string
  recommendedActions: unknown
  promptVersion: string | null
  provider: string | null
  model: string | null
  impactEstimate: unknown
  confidence: number | null
  relatedManagerIds: unknown
  relatedMetrics: unknown
  managerId: string | null
}

function compactText(value: string, maxLength = 110) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

function insightTypeWeight(type: InsightType) {
  switch (type) {
    case 'risk':
      return 2.2
    case 'coach':
      return 1.8
    case 'opportunity':
      return 1.4
    case 'anomaly':
      return 1.2
  }
}

export function normalizeInsightRecord(insight: RawInsightRecord): NormalizedAIInsight {
  return {
    id: insight.id,
    scope: insight.scope as InsightScope,
    type: insight.type.toLowerCase() as InsightType,
    title: insight.title,
    summary: insight.summary,
    why: insight.why,
    recommended_actions: Array.isArray(insight.recommendedActions) ? insight.recommendedActions as string[] : [],
    prompt_version: insight.promptVersion ?? undefined,
    provider: insight.provider ?? undefined,
    model: insight.model ?? undefined,
    impact_estimate_rub:
      typeof insight.impactEstimate === 'number'
        ? insight.impactEstimate
        : insight.impactEstimate
        ? Number(insight.impactEstimate)
        : undefined,
    confidence: insight.confidence ?? undefined,
    related_manager_ids: Array.isArray(insight.relatedManagerIds)
      ? insight.relatedManagerIds as string[]
      : undefined,
    related_metrics: Array.isArray(insight.relatedMetrics) ? insight.relatedMetrics as string[] : undefined,
    managerId: insight.managerId ?? undefined,
  }
}

export function getInsightPriority(insight: Pick<NormalizedAIInsight, 'type' | 'impact_estimate_rub' | 'confidence'>) {
  const impact = insight.impact_estimate_rub ?? 1
  const confidence = insight.confidence ?? 1
  return impact * confidence * insightTypeWeight(insight.type)
}

export function isInsightRelatedToManager(insight: NormalizedAIInsight, managerId: string) {
  return insight.managerId === managerId || insight.related_manager_ids?.includes(managerId) === true
}

export function buildManagerAiTip(insights: NormalizedAIInsight[], managerId: string) {
  const relevant = insights
    .filter((insight) => isInsightRelatedToManager(insight, managerId))
    .sort((a, b) => getInsightPriority(b) - getInsightPriority(a))

  const topInsight = relevant[0]
  if (!topInsight) {
    return undefined
  }

  const lead =
    topInsight.type === 'risk'
      ? 'Риск'
      : topInsight.type === 'opportunity'
      ? 'Возможность'
      : topInsight.type === 'coach'
      ? 'Фокус'
      : 'Аномалия'

  const detail = topInsight.recommended_actions[0] || topInsight.summary || topInsight.title
  return compactText(`${lead}: ${detail}`)
}

export function buildTeamAiSummary(
  insights: NormalizedAIInsight[],
  fallback: { bottleneckStage?: string; planCompletion?: number },
) {
  const sorted = [...insights].sort((a, b) => getInsightPriority(b) - getInsightPriority(a))
  const topRisk = sorted.find((insight) => insight.type === 'risk')
  const topOpportunity = sorted.find((insight) => insight.type === 'opportunity')

  if (topRisk) {
    return {
      title: topRisk.title,
      text: compactText(topRisk.summary || topRisk.why),
      recommendations: topRisk.recommended_actions.slice(0, 3),
      bottleneckStage: fallback.bottleneckStage,
    }
  }

  if (topOpportunity) {
    return {
      title: topOpportunity.title,
      text: compactText(topOpportunity.summary || topOpportunity.why),
      recommendations: topOpportunity.recommended_actions.slice(0, 3),
      bottleneckStage: fallback.bottleneckStage,
    }
  }

  const completion = fallback.planCompletion ?? 0
  if (fallback.bottleneckStage) {
    return {
      title: 'Автоанализ воронки',
      text: `План месяца выполнен на ${completion}%. Узкое место сейчас: ${fallback.bottleneckStage}.`,
      recommendations: ['Проверьте причины потерь на проблемном этапе и назначьте одно действие на сегодня.'],
      bottleneckStage: fallback.bottleneckStage,
    }
  }

  return {
    title: 'AI summary',
    text: 'Инсайты появятся после накопления данных по воронке и команде.',
    recommendations: [],
    bottleneckStage: fallback.bottleneckStage,
  }
}
