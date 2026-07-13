import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../db/database'
import { BackupService } from '../BackupService'
import { type BackupDataV1 } from '../../schemas/backupSchema'

describe('BackupService', () => {
  beforeEach(async () => {
    await BackupService.resetDatabase()
  })

  it('exports an empty database', async () => {
    const json = await BackupService.exportBackup()
    const parsed = JSON.parse(json) as BackupDataV1

    expect(parsed.version).toBe(1)
    expect(typeof parsed.exportedAt).toBe('number')
    expect(parsed.data.subjects).toHaveLength(0)
    expect(parsed.data.topics).toHaveLength(0)
    expect(parsed.data.questions).toHaveLength(0)
    expect(parsed.data.quizAttempts).toHaveLength(0)
    expect(parsed.data.answerAttempts).toHaveLength(0)
  })

  it('exports and restores data correctly', async () => {
    // 1. Seed some data
    await db.transaction('rw', [db.subjects, db.topics, db.questions], async () => {
      await db.subjects.put({
        name: 'Math',
        normalizedName: 'math',
        description: null,
        createdAt: 1000,
        updatedAt: 1000
      })
      await db.topics.put({
        subjectId: 1,
        name: 'Algebra',
        normalizedName: 'algebra',
        createdAt: 1000
      })
      await db.questions.put({
        subjectId: 1,
        topicId: 1,
        questionText: '2 + 2?',
        options: ['3', '4'],
        correctOptionIndex: 1,
        explanation: null,
        difficulty: 'easy',
        bookmarkStatus: 0,
        createdAt: 1000,
        updatedAt: 1000
      })
    })

    // 2. Export
    const backupJson = await BackupService.exportBackup()

    // 3. Reset database
    await BackupService.resetDatabase()
    let subjects = await db.subjects.toArray()
    expect(subjects).toHaveLength(0)

    // 4. Validate and restore
    const validatedData = await BackupService.validateBackup(backupJson)
    await BackupService.restoreBackup(validatedData)

    // 5. Verify restored data
    subjects = await db.subjects.toArray()
    const topics = await db.topics.toArray()
    const questions = await db.questions.toArray()

    expect(subjects).toHaveLength(1)
    expect(subjects[0].name).toBe('Math')

    expect(topics).toHaveLength(1)
    expect(topics[0].name).toBe('Algebra')

    expect(questions).toHaveLength(1)
    expect(questions[0].questionText).toBe('2 + 2?')
  })

  it('fails to validate invalid backup schema', async () => {
    const badBackup = {
      version: 1,
      exportedAt: Date.now(),
      data: {
        subjects: [{ id: 'not a number', name: 'Math' }], // Invalid ID
        topics: [],
        questions: [],
        quizAttempts: [],
        answerAttempts: []
      }
    }

    await expect(BackupService.validateBackup(JSON.stringify(badBackup)))
      .rejects.toThrow(/Invalid backup file/)
  })

  it('fails to validate malformed JSON', async () => {
    await expect(BackupService.validateBackup('not json'))
      .rejects.toThrow(/Invalid backup file/)
  })

  it('fails to validate missing version', async () => {
    const noVersionBackup = {
      exportedAt: Date.now(),
      data: {
        subjects: [],
        topics: [],
        questions: [],
        quizAttempts: [],
        answerAttempts: []
      }
    }

    await expect(BackupService.validateBackup(JSON.stringify(noVersionBackup)))
      .rejects.toThrow(/Invalid backup file/)
  })
})
