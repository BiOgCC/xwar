import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/variables.css'
import './styles/index.css'
import './styles/components.css'
import './styles/layout.css'
import './styles/profile.css'
import './styles/war.css'
import './styles/combat.css'
import './styles/map.css'
import './styles/animations.css'
import 'maplibre-gl/dist/maplibre-gl.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

