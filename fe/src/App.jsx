import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import Home from './pages/Home'
import Store from './pages/Store'
import Character from './pages/Character'
import NotFound from './pages/NotFound'

function MasqueradeLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-3">
      <path d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2z" stroke="#d4af37" strokeWidth="1.5" fill="none"/>
      <path d="M8 14c0-4 3.582-8 8-8s8 4 8 8c0 3-2 6-8 10-6-4-8-7-8-10z" fill="#d4af37" fillOpacity="0.2"/>
      <path d="M10 14c0-2.5 2.5-5 6-5s6 2.5 6 5" stroke="#d4af37" strokeWidth="1.5" fill="none"/>
      <circle cx="12" cy="13" r="1.5" fill="#d4af37"/>
      <circle cx="20" cy="13" r="1.5" fill="#d4af37"/>
      <path d="M14 16c0 1.105.895 2 2 2s2-.895 2-2" stroke="#d4af37" strokeWidth="1" fill="none"/>
      <path d="M16 18v3M13 21h6" stroke="#d4af37" strokeWidth="1" fill="none"/>
    </svg>
  )
}

function NavLink({ to, children, isActive }) {
  return (
    <Link
      to={to}
      className={`relative font-light tracking-widest text-sm uppercase transition-colors duration-300 ${
        isActive ? 'text-[#d4af37]' : 'text-[#718096] hover:text-[#a0a0a0]'
      }`}
    >
      {children}
      <span
        className={`absolute -bottom-1 left-0 h-px bg-[#d4af37] transition-all duration-300 ${
          isActive ? 'w-full' : 'w-0 group-hover:w-full'
        }`}
      />
    </Link>
  )
}

function Navigation() {
  const location = useLocation()
  const isActive = (path) => location.pathname === path

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex items-center group">
            <MasqueradeLogo />
            <span className="text-lg font-serif font-light text-white tracking-[0.2em] group-hover:text-[#d4af37] transition-elegant">
              MASQUERADE
            </span>
          </Link>
          <div className="flex items-center gap-10">
            <NavLink to="/" isActive={isActive('/')}>Rooms</NavLink>
            <NavLink to="/store" isActive={isActive('/store')}>Store</NavLink>
            <NavLink to="/character" isActive={isActive('/character')}>Character</NavLink>
            <div className="ml-2">
              <WalletMultiButton className="!h-9 !px-4 !rounded-lg !text-xs !font-light !tracking-wider !uppercase" />
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <div className="pt-20">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/store" element={<Store />} />
          <Route path="/character" element={<Character />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
