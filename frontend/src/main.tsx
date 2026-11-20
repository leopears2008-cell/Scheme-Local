import { createRoot } from "react-dom/client";
import { AppProvider } from "./lib/state";
import App from "./App";
import "./styles.css";
createRoot(document.getElementById("root")!).render(<AppProvider><App /></AppProvider>);
