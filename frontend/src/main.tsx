import "./styles/fonts.css";
import "./styles/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { router } from "./routes/router.tsx";

// TanStack Query no se monta aquí: lo trae el marco del acceso y del espacio de trabajo
// (routes/QueryRoot.tsx), para que la landing no lo descargue.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
