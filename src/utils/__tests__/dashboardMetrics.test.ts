import { describe, it, expect } from 'vitest'
import { computeDashboardMetrics } from '../dashboardMetrics'
import { type QuizAttempt, type Subject } from '../../types/db'

describe('computeDashboardMetrics', () => {
  it('returns safe zero states for empty attempts list', () => {
    const metrics = computeDashboardMetrics([])
    expect(metrics.totalAttempts).toBe(0)
    expect(metrics.totalQuestionsPresented).toBe(0)
    expect(metrics.totalCorrect).toBe(0)
    expect(metrics.overallAccuracy).toBe(0)
    expect(metrics.totalTimeSpentSeconds).toBe(0)
    expect(metrics.subjectPerformance).toEqual({})
    expect(metrics.practiceStats.accuracyPercentage).toBe(0)
    expect(metrics.examStats.accuracyPercentage).toBe(0)
  })

  it('aggregates total values correctly', () => {
    const mockAttempts: QuizAttempt[] = [
      {
        id: 1,
        subjectId: 1,
        topicId: 1,
        mode: 'practice',
        totalQuestions: 10,
        correctAnswers: 8,
        scorePercentage: 80,
        timeTakenSeconds: 120,
        startedAt: 1000,
        completedAt: 2000,
        subjectNameSnap: 'Math',
        topicNameSnap: 'Algebra'
      },
      {
        id: 2,
        subjectId: 2,
        topicId: null,
        mode: 'exam',
        totalQuestions: 5,
        correctAnswers: 2,
        scorePercentage: 40,
        timeTakenSeconds: 60,
        startedAt: 3000,
        completedAt: 4000,
        subjectNameSnap: 'Science',
        topicNameSnap: null
      }
    ]

    const activeSubjects: Subject[] = [
      { id: 1, name: 'Math', normalizedName: 'math', description: null, createdAt: 1000, updatedAt: 1000 },
      { id: 2, name: 'Science', normalizedName: 'science', description: null, createdAt: 1000, updatedAt: 1000 }
    ]

    const metrics = computeDashboardMetrics(mockAttempts, activeSubjects)
    expect(metrics.totalAttempts).toBe(2)
    expect(metrics.totalQuestionsPresented).toBe(15)
    expect(metrics.totalCorrect).toBe(10)
    expect(metrics.overallAccuracy).toBe(67) // Math.round((10 / 15) * 100) = 67
    expect(metrics.totalTimeSpentSeconds).toBe(180)
  })

  it('groups subjects correctly according to stable identity rules', () => {
    const mockAttempts: QuizAttempt[] = [
      {
        id: 1, // Math attempt 1
        subjectId: 1,
        topicId: null,
        mode: 'practice',
        totalQuestions: 10,
        correctAnswers: 8,
        scorePercentage: 80,
        timeTakenSeconds: 100,
        startedAt: 1000,
        completedAt: 2000,
        subjectNameSnap: 'Math Old Name',
        topicNameSnap: null
      },
      {
        id: 2, // Math attempt 2 (renamed subject)
        subjectId: 1,
        topicId: null,
        mode: 'practice',
        totalQuestions: 10,
        correctAnswers: 9,
        scorePercentage: 90,
        timeTakenSeconds: 100,
        startedAt: 2000,
        completedAt: 3000,
        subjectNameSnap: 'Mathematics',
        topicNameSnap: null
      },
      {
        id: 3, // Biology active (ID 2)
        subjectId: 2,
        topicId: null,
        mode: 'practice',
        totalQuestions: 10,
        correctAnswers: 7,
        scorePercentage: 70,
        timeTakenSeconds: 100,
        startedAt: 3000,
        completedAt: 4000,
        subjectNameSnap: 'Biology',
        topicNameSnap: null
      },
      {
        id: 4, // Biology active same-name (ID 3)
        subjectId: 3,
        topicId: null,
        mode: 'practice',
        totalQuestions: 10,
        correctAnswers: 5,
        scorePercentage: 50,
        timeTakenSeconds: 100,
        startedAt: 4000,
        completedAt: 5000,
        subjectNameSnap: 'Biology',
        topicNameSnap: null
      },
      {
        id: 5, // Deleted subject attempt (subjectId is null)
        subjectId: null,
        topicId: null,
        mode: 'practice',
        totalQuestions: 10,
        correctAnswers: 6,
        scorePercentage: 60,
        timeTakenSeconds: 100,
        startedAt: 5000,
        completedAt: 6000,
        subjectNameSnap: 'History',
        topicNameSnap: null
      },
      {
        id: 6, // Another deleted subject attempt with different original name
        subjectId: null,
        topicId: null,
        mode: 'practice',
        totalQuestions: 10,
        correctAnswers: 4,
        scorePercentage: 40,
        timeTakenSeconds: 100,
        startedAt: 6000,
        completedAt: 7000,
        subjectNameSnap: 'Chemistry',
        topicNameSnap: null
      }
    ]

    const activeSubjects: Subject[] = [
      { id: 1, name: 'Mathematics', normalizedName: 'mathematics', description: null, createdAt: 1000, updatedAt: 1000 },
      { id: 2, name: 'Biology', normalizedName: 'biology', description: null, createdAt: 1000, updatedAt: 1000 },
      { id: 3, name: 'Biology', normalizedName: 'biology', description: null, createdAt: 1000, updatedAt: 1000 }
    ]

    const metrics = computeDashboardMetrics(mockAttempts, activeSubjects)

    // Rule 1: A renamed active Subject remains in one group, and displays the current name
    expect(metrics.subjectPerformance['active-1']).toBeDefined()
    expect(metrics.subjectPerformance['active-1'].attemptsCount).toBe(2)
    expect(metrics.subjectPerformance['active-1'].totalQuestions).toBe(20)
    expect(metrics.subjectPerformance['active-1'].correctAnswers).toBe(17)
    expect(metrics.subjectPerformance['active-1'].subjectName).toBe('Mathematics')

    // Rule 2: Distinct active subjects with identical names remain separate
    expect(metrics.subjectPerformance['active-2']).toBeDefined()
    expect(metrics.subjectPerformance['active-2'].attemptsCount).toBe(1)
    expect(metrics.subjectPerformance['active-2'].correctAnswers).toBe(7)
    expect(metrics.subjectPerformance['active-2'].subjectName).toBe('Biology')

    expect(metrics.subjectPerformance['active-3']).toBeDefined()
    expect(metrics.subjectPerformance['active-3'].attemptsCount).toBe(1)
    expect(metrics.subjectPerformance['active-3'].correctAnswers).toBe(5)
    expect(metrics.subjectPerformance['active-3'].subjectName).toBe('Biology')

    // Rule 3: All deleted subject attempts group under a single truthful aggregate 'deleted'
    // with label "Deleted or unavailable subjects". No false reconstruction or split.
    expect(metrics.subjectPerformance['deleted']).toBeDefined()
    expect(metrics.subjectPerformance['deleted'].attemptsCount).toBe(2)
    expect(metrics.subjectPerformance['deleted'].totalQuestions).toBe(20)
    expect(metrics.subjectPerformance['deleted'].correctAnswers).toBe(10)
    expect(metrics.subjectPerformance['deleted'].subjectName).toBe('Deleted or unavailable subjects')
    expect(metrics.subjectPerformance['deleted'].accuracyPercentage).toBe(50)

    // Rule 4: Deleted attempts still contribute to overall metrics
    expect(metrics.totalAttempts).toBe(6)
    expect(metrics.totalQuestionsPresented).toBe(60)
    expect(metrics.totalCorrect).toBe(39)
    expect(metrics.overallAccuracy).toBe(65) // 39 / 60 = 65%
  })

  it('separates practice and exam modes correctly', () => {
    const mockAttempts: QuizAttempt[] = [
      {
        id: 1,
        subjectId: 1,
        topicId: null,
        mode: 'practice',
        totalQuestions: 10,
        correctAnswers: 8,
        scorePercentage: 80,
        timeTakenSeconds: 100,
        startedAt: 1000,
        completedAt: 2000,
        subjectNameSnap: 'Math',
        topicNameSnap: null
      },
      {
        id: 2,
        subjectId: 1,
        topicId: null,
        mode: 'exam',
        totalQuestions: 10,
        correctAnswers: 6,
        scorePercentage: 60,
        timeTakenSeconds: 100,
        startedAt: 2000,
        completedAt: 3000,
        subjectNameSnap: 'Math',
        topicNameSnap: null
      }
    ]

    const activeSubjects: Subject[] = [
      { id: 1, name: 'Math', normalizedName: 'math', description: null, createdAt: 1000, updatedAt: 1000 }
    ]

    const metrics = computeDashboardMetrics(mockAttempts, activeSubjects)
    expect(metrics.practiceStats.attemptsCount).toBe(1)
    expect(metrics.practiceStats.accuracyPercentage).toBe(80)
    expect(metrics.examStats.attemptsCount).toBe(1)
    expect(metrics.examStats.accuracyPercentage).toBe(60)
  })
})
