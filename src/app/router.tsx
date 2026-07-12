import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import SubjectsPage from '@/pages/SubjectsPage'
import SubjectDetailPage from '@/pages/SubjectDetailPage'
import QuestionsPage from '@/pages/QuestionsPage'
import QuestionFormPage from '@/pages/QuestionFormPage'
import QuizSetupPage from '@/pages/QuizSetupPage'
import QuizPlayPage from '@/pages/QuizPlayPage'
import QuizResultsPage from '@/pages/QuizResultsPage'
import MistakesPage from '@/pages/MistakesPage'
import HistoryPage from '@/pages/HistoryPage'
import SettingsPage from '@/pages/SettingsPage'
import NotFoundPage from '@/pages/NotFoundPage'

export function createRouter() {
  return createBrowserRouter([
    {
      path: '/',
      element: <AppLayout />,
      errorElement: <NotFoundPage />,
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
