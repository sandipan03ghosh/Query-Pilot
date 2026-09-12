import react from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Login from "./pages/Login"
import Register from "./pages/Register"
import Home from "./pages/Home"
import Sessions from "./pages/Sessions"
import NotFound from "./pages/NotFound"
import ProtectedRoute from "./components/ProtectedRoute"
import Layout from "./components/Layout"
import DatabaseSelection from "./pages/DatabaseSelection"
import DatabaseTester from "./pages/DatabaseTester"
import UserProfile from "./pages/UserProfile"
import Dashboard from "./pages/Dashboard"
import ModelMonitoring from "./pages/ModelMonitoring"
import SemanticGraph from "./pages/SemanticGraph"

function Logout() {
  localStorage.clear()
  return <Navigate to="/login" />
}

function RegisterAndLogout() {
  localStorage.clear()
  return <Register />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DatabaseSelection />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sessions"
          element={
            <ProtectedRoute>
              <Sessions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/query/:sessionId"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        {/* Add a default query route that redirects to sessions */}
        <Route
          path="/query"
          element={
            <Navigate to="/sessions" />
          }
        />
        <Route
          path="/databases"
          element={
            <ProtectedRoute>
              <DatabaseSelection />
            </ProtectedRoute>
          }
        />
        <Route
          path="/db-tester"
          element={
            <ProtectedRoute>
              <DatabaseTester />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/model-monitoring"
          element={
            <ProtectedRoute>
              <ModelMonitoring />
            </ProtectedRoute>
          }
        />
        <Route
          path="/semantic-graph"
          element={
            <ProtectedRoute>
              <SemanticGraph />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/register" element={<RegisterAndLogout />} />
        <Route path="*" element={<NotFound />}></Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
