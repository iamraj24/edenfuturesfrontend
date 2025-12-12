import React, { useState, useEffect } from 'react';
import { Container, Card, ListGroup, Spinner, Alert, Row, Col } from 'react-bootstrap';

// 🔗 API CONFIGURATION
// Reads the external backend URL from Vercel's environment variables (VITE_API_BASE_URL).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''; 

// 🔑 SECURITY NOTE: This assumes VITE_ADMIN_KEY is securely handled. 
// For a public results page, a dedicated, UNPROTECTED public endpoint 
// should be used after voting officially closes.
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY; 

/**
 * Renders the results page, fetching winner information for all categories.
 * Includes tie detection logic and a detailed vote breakdown per category.
 */
function WinnersPage() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchWinners = async () => {
            setLoading(true);
            setError(null); // Reset error state
            
            // SECURITY CHECK: Ensure the admin key is available if using the admin endpoint
            if (!ADMIN_KEY) {
                setError("Configuration Error: VITE_ADMIN_KEY is missing. Cannot fetch protected results.");
                setLoading(false);
                return;
            }

            try {
                // Fetch results from the admin endpoint
                const response = await fetch(`${API_BASE_URL}/api/admin/winners`, {
                    headers: { 'X-Admin-Key': ADMIN_KEY } // Using Admin Key to access results endpoint
                });
                
                if (response.ok) {
                    const data = await response.json();
                    setResults(data);
                } else {
                    // Attempt to read a more specific error message from the response body
                    let errorMessage = `Error fetching winners. Server error (Status: ${response.status}).`;
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.message || errorMessage;
                    } catch (e) {
                        // Ignore JSON parsing error if response body is not JSON
                    }
                    setError(errorMessage);
                }
            } catch (err) {
                console.error("Network or Fetch Error:", err);
                setError('Network error connecting to the server. Check API_BASE_URL.');
            } finally {
                setLoading(false);
            }
        };
        fetchWinners();
    }, []);

    if (loading) return <Spinner animation="grow" variant="success" className="d-block mx-auto mt-5" role="status"><span className="visually-hidden">Loading Winners...</span></Spinner>;
    if (error) return <Alert variant="danger" className="mt-5 text-center">**Results Error:** {error}</Alert>;

    return (
        <Container className="my-5">
            <h2 className="text-center mb-5 text-success">🎉 Official Award Winners!</h2>
            {results.length === 0 && <Alert variant="info">No results available yet. Please ensure voting has closed and categories are set up.</Alert>}
            
            <Row>
                {results.map((item, index) => {
                    const maxVotes = item.winner.voteCount;
                    const hasZeroVotes = maxVotes === 0;

                    let winnerStatus = "Winner";
                    let winnerName = item.winner.name;
                    let winnerVariant = "text-success"; // Default text color for a clear winner
                    
                    // --- TIE DETECTION AND STATUS ASSIGNMENT ---
                    if (!hasZeroVotes) {
                        // Filter all nominees that match the maximum vote count
                        const tiedNominees = item.fullTally.filter(
                            nom => nom.voteCount === maxVotes
                        );

                        if (tiedNominees.length > 1) {
                            // TIE DETECTED
                            winnerStatus = "TIE!";
                            // Join all tied names for display
                            winnerName = tiedNominees.map(nom => nom.name).join(' & ');
                            winnerVariant = "text-warning"; // Use warning color for tie
                        }
                    }

                    // Filter nominees with more than zero votes for the breakdown list
                    // This prevents displaying names that received 0 votes in the details section
                    const votedNominees = item.fullTally
                        .filter(nom => nom.voteCount > 0)
                        .sort((a, b) => b.voteCount - a.voteCount); // Sort by vote count descending

                    return (
                        <Col md={6} lg={4} key={index} className="mb-4 d-flex">
                            <Card className="shadow-lg h-100 w-100 border-success">
                                <Card.Header as="h3" className="bg-success text-white py-3">
                                    {item.categoryName}
                                </Card.Header>
                                <Card.Body>
                                    {hasZeroVotes ? (
                                        <p className="text-danger lead">
                                            🗳️ **No Votes Recorded Yet**
                                        </p>
                                    ) : (
                                        <>
                                            {/* Display dynamic status and name */}
                                            <p className={`lead mb-0 ${winnerVariant} d-flex align-items-center`}>
                                                <span className={`me-2 ${winnerStatus === "TIE!" ? 'text-warning' : 'text-success'}`}>
                                                    {winnerStatus === "TIE!" ? '🤝' : '🏆'}
                                                </span>
                                                **{winnerStatus}:** <span className="fw-bolder ms-1">{winnerName}</span>
                                            </p>
                                            <small className="text-muted">Total Votes: **{maxVotes}**</small>
                                        </>
                                    )}
                                </Card.Body>
                                {/* Detailed Tally for transparency */}
                                <Card.Footer className="bg-light">
                                    <details>
                                        <summary className="fw-bold text-primary">Full Vote Breakdown ({votedNominees.length} Nominees Voted)</summary>
                                        <ListGroup variant="flush" className="mt-2 border rounded">
                                            {/* Filtered list is used to only show nominees with votes, sorted by count */}
                                            {votedNominees.map(nom => (
                                                <ListGroup.Item 
                                                    key={nom.id} 
                                                    className="d-flex justify-content-between align-items-center p-2"
                                                >
                                                    <span className={(!hasZeroVotes && nom.voteCount === maxVotes) ? 'fw-bold text-success' : ''}>
                                                        {nom.name} 
                                                    </span>
                                                    {/* Highlight those with the max vote count */}
                                                    <span className={`badge ${(!hasZeroVotes && nom.voteCount === maxVotes) ? 'bg-success' : 'bg-secondary'}`}>
                                                        {nom.voteCount} Votes
                                                    </span>
                                                </ListGroup.Item>
                                            ))}
                                        </ListGroup>
                                        {votedNominees.length === 0 && <p className="text-muted mt-2 mb-0">No votes recorded yet.</p>}
                                    </details>
                                </Card.Footer>
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        </Container>
    );
}

export default WinnersPage;