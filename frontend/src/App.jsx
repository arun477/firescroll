import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, Flame, Key, Github } from 'lucide-react'
import Landing from './pages/Landing'
import Feed from './pages/Feed'
import Dashboard from './pages/Dashboard'
import TopicDetail from './pages/TopicDetail'
import CreateTopic from './pages/CreateTopic'
import Settings from './pages/Settings'

function Logo() {
  return (
    <svg className="sidebar-logo-icon" width="22" height="22" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="fg" x1="0%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stopColor="#ef4444"/>
          <stop offset="50%" stopColor="#f97316"/>
          <stop offset="100%" stopColor="#fbbf24"/>
        </linearGradient>
      </defs>
      <path d="M32 4C24 16,14 22,14 36c0,11,8,20,18,20s18-9,18-20c0-8-5-15-10-20c0,10-5,15-8,15s-5-5-2-15z" fill="url(#fg)"/>
    </svg>
  )
}

export default function App() {
  const location = useLocation()
  const isLanding = location.pathname === '/'

  if (isLanding) {
    return <Landing />
  }

  return (
    <div className="app">
      <nav className="sidebar-nav">
        <div className="sidebar-logo">
          <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}>
            <Logo />
            <span className="logo-text">FireScroll</span>
          </NavLink>
        </div>
        <div className="sidebar-links">
          <NavLink to="/feed"><Flame size={18} />Feed</NavLink>
          <NavLink to="/dashboard"><LayoutDashboard size={18} />Dashboard</NavLink>
          <NavLink to="/create"><PlusCircle size={18} />Create</NavLink>
          <NavLink to="/settings"><Key size={18} />API Keys</NavLink>
        </div>
        <div className="sidebar-footer">
          <a href="https://github.com/arun477/firescroll" target="_blank" rel="noopener noreferrer" className="sidebar-github">
            <Github size={15} />
            <span>GitHub</span>
          </a>
        </div>
      </nav>
      <div className="main-content">
        <Routes>
          <Route path="/feed" element={<Feed />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/topic/:topicId" element={<TopicDetail />} />
          <Route path="/create" element={<CreateTopic />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  )
}
