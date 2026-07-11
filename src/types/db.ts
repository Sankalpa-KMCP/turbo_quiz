export type Difficulty = 'easy' | 'medium' | 'hard'

export type BookmarkStatus = 0 | 1

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

export interface Subject {
  id: number
  name: string
  normalizedName: string
  description: string | null
  createdAt: number
  updatedAt: number
}

export interface SubjectInput {
  name: string
  description: string | null
}

export interface SubjectUpdateInput {
  name?: string
  description?: string | null
}

export interface Topic {
  id: number
  subjectId: number
  name: string
  normalizedName: string
  createdAt: number
}

export interface TopicInput {
  subjectId: number
  name: string
}

export interface TopicUpdateInput {
  name?: string
}

export interface Question {
  id: number
  subjectId: number
  topicId: number | null
  questionText: string
  options: string[]
  correctOptionIndex: number
  explanation: string | null
  difficulty: Difficulty
  bookmarkStatus: BookmarkStatus
  createdAt: number
  updatedAt: number
}

export interface QuestionInput {
  subjectId: number
  topicId: number | null
  questionText: string
  options: string[]
  correctOptionIndex: number
  explanation: string | null
  difficulty: Difficulty
  bookmarkStatus?: BookmarkStatus
}

export interface QuestionUpdateInput {
  subjectId?: number
  topicId?: number | null
  questionText?: string
  options?: string[]
  correctOptionIndex?: number
  explanation?: string | null
  difficulty?: Difficulty
  bookmarkStatus?: BookmarkStatus
}
