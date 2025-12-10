import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AdminPage from './pages/Admin';
import PublicVoting from './pages/PublicVoting';
import WinnersPage from './pages/Winners';

function App() {
  // 1. Voter State (Persistent via localStorage)
  const [voterId, setVoterId] = useState(localStorage.getItem('voterId') || null);
  
  // 2. Admin State (NOW PERSISTENT VIA localStorage CHECK)
  const [adminLoggedIn, setAdminLoggedIn] = useState(
    localStorage.getItem('isAdminLoggedIn') === 'true' // Check localStorage for persistent state
  );

  // 3. Redirect State
  const [shouldRedirectHome, setShouldRedirectHome] = useState(false);

// ------------------------------------
// 🎯 ADMIN LOGIN HANDLERS
// ------------------------------------

  // Function to handle successful Admin Login (called by AdminPage)
  const handleAdminLogin = () => {
    setAdminLoggedIn(true);
    // Persist the admin state
    localStorage.setItem('isAdminLoggedIn', 'true');
    // NOTE: Ensure the AdminPage component calls this function, and
    // it no longer sets its own local storage flag.
  };


  const handleSignedIn = (id) => {
    setVoterId(id);
    localStorage.setItem('voterId', id);
  };

  // Function to handle global logout (passed to Layout)
  const handleSignOut = () => {
    // Clear Voter Session
    localStorage.removeItem('voterId');
    setVoterId(null);
    
    // Clear Admin Session and remove persistent flag
    setAdminLoggedIn(false);
    localStorage.removeItem('isAdminLoggedIn'); // 🔑 Clear persistent admin flag

    // Trigger Redirect
    setShouldRedirectHome(true);
  };
  
  // Reset the redirect signal after it's processed
  useEffect(() => {
    if (shouldRedirectHome) {
      setShouldRedirectHome(false);
    }
  }, [shouldRedirectHome]);

  return (
    <Router>
      {/* LAYOUT PROP UPDATE: 
         Pass a truthy value to 'voterId' if EITHER voterId exists OR admin is logged in.
         This ensures Layout renders the Logout button in both cases.
      */}
      <Layout voterId={voterId || (adminLoggedIn ? "ADMIN_SESSION" : null)} onLogout={handleSignOut}>
        
        {shouldRedirectHome && <Navigate to="/" replace />}

        <Routes>
          <Route 
            path="/" 
            element={
                <PublicVoting 
                    voterId={voterId} 
                    onSignedIn={!voterId ? handleSignedIn : undefined} 
                />
            }
          />
          
          <Route path="/winners" element={<WinnersPage />} />
          
          {/* Pass admin state and the persistent login handler */}
          <Route 
            path="/admin" 
            element={
                <AdminPage 
                    isAdmin={adminLoggedIn} 
                    onLogin={handleAdminLogin} // Use the new persistent handler
                />
            } 
          /> 
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;