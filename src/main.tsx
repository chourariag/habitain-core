import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./i18n";
import "./index.css";
import { registerServiceWorker } from "./pwa/registerSW";
import { registerPreloadErrorRecovery } from "./pwa/preloadRecovery";

registerPreloadErrorRecovery();

createRoot(document.getElementById("root")!).render(<App />);

registerServiceWorker();
