import { Navigate } from "react-router-dom";

// Auth has been removed — single-user mode.
export default function Auth() {
  return <Navigate to="/connection" replace />;
}
