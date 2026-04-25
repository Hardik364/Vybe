import { useState, useEffect } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import SingUp from "./SingUp";
import ChatPage from "./ChatPage";
import AdminDashboard from "./AdminDashboard";
import CommunityPage from "./CommunityPage";
import { initIceServers } from "../utils/pcInstance";

function App() {
  const [username, setUsername] = useState(null)

  // Warm up ICE server cache once — all subsequent setPcInstance() calls are synchronous
  useEffect(() => { initIceServers() }, [])

  // Register service worker for Web Push (Notify Me)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('[SW] Registration failed:', err)
      })
    }
  }, [])

  function handleSetUsername(name) {
    setUsername(name)
  }

  const router = createBrowserRouter([
    {
      path: '/',
      element: <SingUp setUsername={handleSetUsername} />,
    },
    {
      path: '/chat',
      element: <ChatPage username={username} setUsername={handleSetUsername} />
    },
    {
      path: '/admin',
      element: <AdminDashboard />
    },
    {
      path: '/community',
      element: <CommunityPage username={username} />
    }
  ]);

  return <RouterProvider router={router} />;
}

export default App;
