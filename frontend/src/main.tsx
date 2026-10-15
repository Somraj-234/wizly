import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@fontsource/plus-jakarta-sans/400.css"
import "@fontsource/plus-jakarta-sans/500.css"
import "@fontsource/plus-jakarta-sans/600.css"
import App from "./App"
import "./index.css"
import { cache } from "./lib/storage"

document.documentElement.classList.toggle("dark", cache.theme() === "dark")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
