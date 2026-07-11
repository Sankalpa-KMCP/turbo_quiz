import { type QuizDatabase } from '../database'
import {
  type QuizAttempt,
  type QuizAttemptSessionSaveInput
} from '../../types/db'
import { quizAttemptSessionSaveSchema } from '../../schemas/quizAttemptSchema'
import {
  validateSchema,
  translatePersistenceError,
  reconstructRepositoryError,
  isRepositoryOrSerializedError
} from '../errors'

export class QuizRepository {
  private readonly db: QuizDatabase
  private readonly now: () => number

  constructor(db: QuizDatabase, now: () => number = Date.now) {
    this.db = db
    this.now = now
  }

  async save(input: QuizAttemptSessionSaveInput): Promise<QuizAttempt> {
    const validated = validateSchema(quizAttemptSessionSaveSchema, input, 'QuizAttempt')
    let repoError: unknown = null

    try {
      return await this.db.transaction(
        'rw',
        [this.db.quizAttempts, this.db.answerAttempts, this.db.subjects, this.db.topics, this.db.questions],
        async () => {
          try {
            // 1. Resolve current Subject relationship
            const subject = await this.db.subjects.get(validated.subjectId)
            const resolvedSubjectId = subject ? validated.subjectId : null

            // 2. Resolve current Topic relationship
            let resolvedTopicId: number | null = null
            if (validated.topicId !== null) {
              const topic = await this.db.topics.get(validated.topicId)
              if (topic) {
                resolvedTopicId = validated.topicId
              }
            }

            // 3. Resolve current Question relationships
            const questionIds = validated.answers.map((a) => a.questionId)
            const questions = await this.db.questions.bulkGet(questionIds)
            const existingQuestionIds = new Set<number>()
            questions.forEach((q) => {
              if (q) {
                existingQuestionIds.add(q.id)
              }
            })

            // 4. Derive AnswerAttempts and aggregate statistics
            const timestamp = this.now()
            let correctAnswersCount = 0
            const totalQuestionsCount = validated.answers.length
            let totalTimeTaken = 0

            const answerAttemptsToInsert = validated.answers.map((answer) => {
              const snap = answer.questionSnapshot
              const isCorrect =
                answer.selectedOptionIndex !== null &&
                answer.selectedOptionIndex === snap.correctOptionIndex

              if (isCorrect) {
                correctAnswersCount++
              }
              totalTimeTaken += answer.timeTakenSeconds

              return {
                quizAttemptId: 0, // Updated post insertion of QuizAttempt
                questionId: existingQuestionIds.has(answer.questionId) ? answer.questionId : null,
                selectedOptionIndex: answer.selectedOptionIndex,
                correctOptionIndex: snap.correctOptionIndex,
                isCorrect,
                timeTakenSeconds: answer.timeTakenSeconds,
                questionSnapshot: {
                  questionText: snap.questionText,
                  options: [...snap.options], // Defensive copy of options
                  correctOptionIndex: snap.correctOptionIndex,
                  explanation: snap.explanation,
                  difficulty: snap.difficulty
                }
              }
            })

            const scorePercentageVal = Math.round((correctAnswersCount / totalQuestionsCount) * 100)

            // 5. Build and insert QuizAttempt
            const quizAttemptToInsert = {
              subjectId: resolvedSubjectId,
              topicId: resolvedTopicId,
              mode: validated.mode,
              totalQuestions: totalQuestionsCount,
              correctAnswers: correctAnswersCount,
              scorePercentage: scorePercentageVal,
              timeTakenSeconds: totalTimeTaken,
              startedAt: validated.startedAt,
              completedAt: timestamp,
              subjectNameSnap: validated.subjectNameSnap,
              topicNameSnap: validated.topicNameSnap
            }

            const quizAttemptId = await this.db.quizAttempts.add(quizAttemptToInsert)

            // 6. Sequentially insert AnswerAttempts
            for (const answerAttempt of answerAttemptsToInsert) {
              answerAttempt.quizAttemptId = quizAttemptId
              await this.db.answerAttempts.add(answerAttempt)
            }

            return {
              id: quizAttemptId,
              ...quizAttemptToInsert
            }
          } catch (err) {
            repoError = err
            throw err
          }
        }
      )
    } catch (err) {
      if (repoError) {
        throw reconstructRepositoryError(repoError)
      }
      if (err && typeof err === 'object' && 'inner' in err && isRepositoryOrSerializedError(err.inner)) {
        throw reconstructRepositoryError(err.inner)
      }
      if (isRepositoryOrSerializedError(err)) {
        throw reconstructRepositoryError(err)
      }
      translatePersistenceError(err, {
        entityType: 'QuizAttempt',
        operation: 'save'
      })
    }
  }
}
