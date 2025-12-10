import React, { useState, useEffect } from 'react';
import { Container, Card, ListGroup, Spinner, Alert, Row, Col } from 'react-bootstrap';

// 🔗 API CONFIGURATION
// Reads the external backend URL from Vercel's environment variables (VITE_API_BASE_URL).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''; 

// NOTE: Since the /api/admin/winners route is protected on the backend, 
// the admin key is required here. In a real public-facing app, you'd create 
// a dedicated, unprotected public endpoint for results *after* voting closes.
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY; 

function WinnersPage() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchWinners = async () => {
            setLoading(true);
            try {
                // >>> URL FIX HERE: Added API_BASE_URL
                const response = await fetch(`${API_BASE_URL}/api/admin/winners`, {
                    headers: { 'X-Admin-Key': ADMIN_KEY } // Using Admin Key to access results endpoint
                });
                
                if (response.ok) {
                    const data = await response.json();
                    setResults(data);
                } else {
                    setError('Error fetching winners. Access denied or server error.');
                }
            } catch (err) {
                setError('Network error connecting to the server.');
            } finally {
                setLoading(false);
            }
        };
        fetchWinners();
    }, []);

    if (loading) return <Spinner animation="grow" variant="success" className="d-block mx-auto mt-5" />;
    if (error) return <Alert variant="danger" className="mt-5 text-center">{error}</Alert>;

    return (
        <Container className="my-5">
            <h2 className="text-center mb-5 text-success">🎉 Official Award Winners!</h2>
            {results.length === 0 && <Alert variant="info">No results available yet. Check the Admin panel for categories.</Alert>}
            
            <Row>
                {results.map((item, index) => {
                    const maxVotes = item.winner.voteCount;
                    const hasZeroVotes = maxVotes === 0;

                    let winnerStatus = "Winner";
                    let winnerName = item.winner.name;
                    let winnerVariant = "text-success"; // Default text color

                    if (!hasZeroVotes) {
                        // 🛑 TIE DETECTION LOGIC 🛑
                        
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

                    return (
                        <Col md={6} lg={4} key={index} className="mb-4">
                            <Card className="shadow-lg h-100 border-success">
                                <Card.Header as="h3" className="bg-success text-white">
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
                                            <p className={`lead mb-0 ${winnerVariant}`}>
                                                **{winnerStatus}:** <span className="fw-bolder">{winnerName}</span>
                                            </p>
                                            <small className="text-muted">Total Votes: {maxVotes}</small>
                                        </>
                                    )}
                                </Card.Body>
                                {/* Detailed Tally for transparency (optional) */}
                                <Card.Footer className="bg-light">
                                    <details>
                                        <summary>Full Vote Breakdown</summary>
                                        <ListGroup variant="flush" className="mt-2">
                                            {item.fullTally.map(nom => (
                                                <ListGroup.Item key={nom.id} className="d-flex justify-content-between">
                                                    {nom.name} 
                                                    {/* Highlight those with the max vote count */}
                                                    <span className={`fw-bold ${(!hasZeroVotes && nom.voteCount === maxVotes) ? 'text-success' : 'text-muted'}`}>{nom.voteCount} Votes</span>
                                                </ListGroup.Item>
                                            ))}
                                        </ListGroup>
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