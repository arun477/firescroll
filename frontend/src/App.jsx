import { Routes, Route, NavLink } from 'react-router-dom'
import { Flame, LayoutDashboard, PlusCircle, Settings as SettingsIcon } from 'lucide-react'
import Feed from './pages/Feed'
import Dashboard from './pages/Dashboard'
import TopicDetail from './pages/TopicDetail'
import CreateTopic from './pages/CreateTopic'
import Settings from './pages/Settings'

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="fl" x1="0%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stopColor="#ef4444"/>
          <stop offset="50%" stopColor="#f97316"/>
          <stop offset="100%" stopColor="#fbbf24"/>
        </linearGradient>
        <linearGradient id="il" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#fbbf24"/>
          <stop offset="100%" stopColor="#fff7cc"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14"
        fill="#141416" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
      <path d="M32 8C26 18,18 22,18 34c0,9,6.5,16,14,16s14-7,14-16c0-6-4-12-8-16
        c0,8-4,12-6,12s-4-4-2-12z" fill="url(#fl)" opacity="0.95"/>
      <path d="M32 22c-3,6-6,10-6,14c0,4,2.5,7,6,7s6-3,6-7c0-3-2-7-4-9
        c0,4-1,6-2,6s-2-2-1-6z" fill="url(#il)"/>
      <rect x="20" y="53" width="24" height="3" rx="1.5"
        fill="url(#fl)" opacity="0.8"/>
    </svg>
  )
}

export default function App() {
  return (
    <div className="app">
      <nav className="sidebar-nav">
        <div className="sidebar-logo">
          <Logo />
          <span className="logo-text">FireScroll</span>
        </div>
        <div className="sidebar-links">
          <NavLink to="/" end><Flame size={18} />Feed</NavLink>
          <NavLink to="/dashboard"><LayoutDashboard size={18} />Dashboard</NavLink>
          <NavLink to="/create"><PlusCircle size={18} />Create</NavLink>
          <div style={{ flex: 1 }} />
          <NavLink to="/settings"><SettingsIcon size={18} />Settings</NavLink>
        </div>
      </nav>
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/topic/:topicId" element={<TopicDetail />} />
          <Route path="/create" element={<CreateTopic />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  )
}
