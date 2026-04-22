import { useState } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import SingUp from "./SingUp";
import ChatPage from "./ChatPage";
import AdminDashboard from "./AdminDashboard";

function App() {
  const [username, setUsername] = useState(null)

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
    }
  ]);

  return <RouterProvider router={router} />;
}

export default App;
