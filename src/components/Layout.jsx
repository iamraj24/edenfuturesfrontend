import React, { useState } from 'react'; // 1. Import useState
import { Container, Navbar, Nav, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom'; 

/**
 * Layout Component
 * (Props remain the same: { children, voterId, onLogout })
 */
function Layout({ children, voterId, onLogout }) {
    // 2. State to manage the expanded/collapsed state of the Navbar
    const [expanded, setExpanded] = useState(false);
    
    // Check if a voter or admin is currently signed in
    const isLoggedIn = !!voterId;
    
    // Check if the current session token is the special ADMIN token from App.jsx
    const isAdminSession = voterId === "ADMIN_SESSION";

    // Determine the button text based on the session type
    const logoutButtonText = isAdminSession ? 'Logout' : 'Logout';

    // 3. Handler to close the navbar and then trigger link navigation
    const handleNavClick = () => {
        setExpanded(false); // Collapse the navbar
    };

    // Handler for the logout action
    const handleLogout = () => {
        if (onLogout) {
            onLogout();
        }
    };

    return (
        <>
            <Navbar 
                bg="dark" 
                variant="dark" 
                expand="lg" 
                className="shadow-lg"
                expanded={expanded} // 4. Bind the state to the Navbar
                onToggle={() => setExpanded(!expanded)} // 5. Allow manual toggle
            >
                <Container>
                    {/* Use onClick handler on Brand to close navbar when clicked */}
                    <Navbar.Brand as={Link} to="/" onClick={handleNavClick}>🏆 Eden Futures Award </Navbar.Brand>
                    
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="ms-auto">
                            {/* 6. Attach handleNavClick to close menu after navigation */}
                            <Nav.Link as={Link} to="/" onClick={handleNavClick}>Vote Now</Nav.Link>
                            <Nav.Link as={Link} to="/winners" onClick={handleNavClick}>Winners</Nav.Link>
                            {/* <Nav.Link as={Link} to="/admin" className="text-warning">Admin</Nav.Link> */}
                            
                            {/* Conditional Logout Button (Updated Text) */}
                            {isLoggedIn && (
                                <Button 
                                    variant={isAdminSession ? "outline-warning" : "outline-danger"} 
                                    size="sm"
                                    className="ms-3 my-2 my-lg-0" 
                                    onClick={handleLogout} 
                                >
                                    {logoutButtonText} {/* Dynamic text */}
                                </Button>
                            )}

                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>
            <main>{children}</main>
        </>
    );
}

export default Layout;