/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import { lazy } from 'react'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const SubjectsPage = lazy(() => import('@/pages/SubjectsPage'))
const SubjectDetailPage = lazy(() => import('@/pages/SubjectDetailPage'))
const QuestionsPage = lazy(() => import('@/pages/QuestionsPage'))
const QuestionFormPage = lazy(() => import('@/pages/QuestionFormPage'))
const QuizSetupPage = lazy(() => import('@/pages/QuizSetupPage'))
const QuizPlayPage = lazy(() => import('@/pages/QuizPlayPage'))
const QuizResultsPage = lazy(() => import('@/pages/QuizResultsPage'))
const MistakesPage = lazy(() => import('@/pages/MistakesPage'))
const HistoryPage = lazy(() => import('@/pages/HistoryPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

import GlobalErrorBoundary from '@/components/layout/GlobalErrorBoundary'

export function createRouter() {
  return createBrowserRouter([
    {
      path: '/',
      element: <AppLayout />,
      errorElement: <GlobalErrorBoundary />,
      children: [
        {
          index: true,
          element: <Dashboard />
        },
        {
          path: 'subjects',
          element: <SubjectsPage />
        },
        {
          path: 'subjects/:subjectId',
          element: <SubjectDetailPage />
        },
        {
          path: 'questions',
          element: <QuestionsPage />
        },
        {
          path: 'questions/new',
          element: <QuestionFormPage />
        },
        {
          path: 'questions/:questionId/edit',
          element: <QuestionFormPage />
        },
        {
          path: 'quiz/setup',
          element: <QuizSetupPage />
        },
        {
          path: 'quiz/play',
          element: <QuizPlayPage />
        },
        {
          path: 'quiz/results/:attemptId',
          element: <QuizResultsPage />
        },
        {
          path: 'quiz/results',
          element: <Navigate to="/quiz/setup" replace />
        },
        {
          path: 'mistakes',
          element: <MistakesPage />
        },
        {
          path: 'history',
          element: <HistoryPage />
        },
        {
          path: 'settings',
          element: <SettingsPage />
        },
        {
          path: '*',
          element: <NotFoundPage />
        }
      ]
    }
  ])
}
