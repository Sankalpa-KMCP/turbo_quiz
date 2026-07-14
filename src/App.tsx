import { RouterProvider } from 'react-router-dom'
import { createRouter } from './app/router'
import { ReloadPrompt } from './components/layout/ReloadPrompt'

function App() {
  const router = createRouter()
  return (
    <>
      <RouterProvider router={router} />
      <ReloadPrompt />
    </>
  )
}

export default App
