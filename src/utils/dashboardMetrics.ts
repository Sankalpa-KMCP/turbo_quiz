import { type QuizAttempt, type Subject } from '../types/db'

export interface SubjectMetric {
  subjectName: string
  attemptsCount: number
  correctAnswers: number
  totalQuestions: number
  accuracyPercentage: number
}

export interface DashboardMetrics {
  totalAttempts: number
  totalQuestionsPresented: number
  totalCorrect: number
  overallAccuracy: number
  totalTimeSpentSeconds: number
  subjectPerformance: Record<string, SubjectMetric>
  practiceStats: {
    attemptsCount: number
    correctAnswers: number
    totalQuestions: number
    accuracyPercentage: number
  }
  examStats: {
    attemptsCount: number
    correctAnswers: number
    totalQuestions: number
    accuracyPercentage: number
  }
  mistakesStats: {
    attemptsCount: number
    correctAnswers: number
    totalQuestions: number
    accuracyPercentage: number
  }
}

/**
 * Aggregates performance metrics from a list of quiz attempts.
 *
 * Grouping identity rule:
 * - Active subjects are grouped strictly by ID (`active-${subjectId}`) to prevent rename splits.
 * - Deleted subjects (subjectId is null or not present in activeSubjects) are grouped under
 *   a single aggregate key "deleted" to represent them truthfully without speculative identity inference.
 *
 * Percentages are calculated as weighted averages (total correct / total questions)
 * rather than averages of per-attempt percentages.
 */
export function computeDashboardMetrics(attempts: QuizAttempt[], activeSubjects: Subject[] = []): DashboardMetrics {
  const metrics: DashboardMetrics = {
    totalAttempts: attempts.length,
    totalQuestionsPresented: 0,
    totalCorrect: 0,
    overallAccuracy: 0,
    totalTimeSpentSeconds: 0,
    subjectPerformance: {},
    practiceStats: { attemptsCount: 0, correctAnswers: 0, totalQuestions: 0, accuracyPercentage: 0 },
    examStats: { attemptsCount: 0, correctAnswers: 0, totalQuestions: 0, accuracyPercentage: 0 },
    mistakesStats: { attemptsCount: 0, correctAnswers: 0, totalQuestions: 0, accuracyPercentage: 0 }
  }

  if (attempts.length === 0) {
    return metrics
  }

  const activeSubjectsMap = new Map<number, string>()
  for (const sub of activeSubjects) {
    activeSubjectsMap.set(sub.id, sub.name)
  }

  for (const attempt of attempts) {
    metrics.totalQuestionsPresented += attempt.totalQuestions
    metrics.totalCorrect += attempt.correctAnswers
    metrics.totalTimeSpentSeconds += attempt.timeTakenSeconds

    // Grouping ID rule
    const isSubjectActive = attempt.subjectId !== null && activeSubjectsMap.has(attempt.subjectId)
    const key = isSubjectActive
      ? `active-${attempt.subjectId}`
      : 'deleted'

    const subjectName = isSubjectActive
      ? activeSubjectsMap.get(attempt.subjectId!)!
      : 'Deleted or unavailable subjects'

    if (!metrics.subjectPerformance[key]) {
      metrics.subjectPerformance[key] = {
        subjectName,
        attemptsCount: 0,
        correctAnswers: 0,
        totalQuestions: 0,
        accuracyPercentage: 0
      }
    }
    const subPerf = metrics.subjectPerformance[key]
    subPerf.attemptsCount++
    subPerf.correctAnswers += attempt.correctAnswers
    subPerf.totalQuestions += attempt.totalQuestions

    // Mode breakdown
    if (attempt.mode === 'practice') {
      metrics.practiceStats.attemptsCount++
      metrics.practiceStats.correctAnswers += attempt.correctAnswers
      metrics.practiceStats.totalQuestions += attempt.totalQuestions
    } else if (attempt.mode === 'exam') {
      metrics.examStats.attemptsCount++
      metrics.examStats.correctAnswers += attempt.correctAnswers
      metrics.examStats.totalQuestions += attempt.totalQuestions
    } else if (attempt.mode === 'mistakes') {
      metrics.mistakesStats.attemptsCount++
      metrics.mistakesStats.correctAnswers += attempt.correctAnswers
      metrics.mistakesStats.totalQuestions += attempt.totalQuestions
    }
  }

  // Calculate weighted percentages
  if (metrics.totalQuestionsPresented > 0) {
    metrics.overallAccuracy = Math.round((metrics.totalCorrect / metrics.totalQuestionsPresented) * 100)
  }

  for (const key of Object.keys(metrics.subjectPerformance)) {
    const subPerf = metrics.subjectPerformance[key]
    if (subPerf.totalQuestions > 0) {
      subPerf.accuracyPercentage = Math.round((subPerf.correctAnswers / subPerf.totalQuestions) * 100)
    }
  }

  if (metrics.practiceStats.totalQuestions > 0) {
    metrics.practiceStats.accuracyPercentage = Math.round(
      (metrics.practiceStats.correctAnswers / metrics.practiceStats.totalQuestions) * 100
    )
  }

  if (metrics.examStats.totalQuestions > 0) {
    metrics.examStats.accuracyPercentage = Math.round(
      (metrics.examStats.correctAnswers / metrics.examStats.totalQuestions) * 100
    )
  }

  if (metrics.mistakesStats.totalQuestions > 0) {
    metrics.mistakesStats.accuracyPercentage = Math.round(
      (metrics.mistakesStats.correctAnswers / metrics.mistakesStats.totalQuestions) * 100
    )
  }

  return metrics
}
