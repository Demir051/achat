import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import ThemeBackground from "./components/ThemeBackground";
import ToastContainer from "./components/ToastContainer";
import { useAuth } from "./store/auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Settings from "./pages/Settings";

function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";

  return (
    <>
      {!isAuthPage && <ThemeBackground />}
      <ToastContainer />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
        <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" />} />
        <Route path="/*" element={user ? <Home /> : <Navigate to="/login" />} />
      </Routes>
    </>
  );
}

export default function App() {
  const { user, loading, init } = useAuth();

  useEffect(() => {
    init();
  }, [init]);

  if (loading) {
    return (
      <>
        <ThemeBackground />
        <div className="loading-screen">
          <div className="loading-pulse" />
          yükleniyor…
        </div>
      </>
    );
  }

  return <AppRoutes />;
}
