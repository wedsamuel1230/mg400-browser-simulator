import React from "react";
import { createRoot } from "react-dom/client";
import EditorWorker from "../node_modules/monaco-editor/esm/vs/editor/editor.worker?worker";
import App from "./App";
import "./styles.css";

self.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
