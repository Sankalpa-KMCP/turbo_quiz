import { RouterProvider } from 'react-router-dom'
import { createRouter } from './app/router'

function App() {
  const router = createRouter()
  return <RouterProvider router={router} />
}

export default App
