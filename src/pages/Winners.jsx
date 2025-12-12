import React, { useState, useEffect } from 'react';
import { Container, Card, ListGroup, Alert, Row, Col } from 'react-bootstrap';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''; 
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY;

function WinnersPage() {
    const [results, setResults] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        // 1️⃣ Load cached results immediately
        const cached = localStorage.getItem('winnersCache');
        if (cached) {
            try {
                setResults(JSON.parse(cached));
            } catch (e) {
                console.error("Failed to parse cached winners:", e);
            }
        }

        // 2️⃣ Fetch fresh results from API in the background
        const fetchWinners = async () => {
            if (!ADMIN_KEY) {
                setError("Configuration Error: VITE_ADMIN_KEY is missing.");
                return;
            }
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/winners`, {
                    headers: { 'X-Admin-Key': ADMIN_KEY }
                });
                if (!response.ok) throw new Error(`Status ${response.status}`);
                const data = await response.json();
                setResults(data);
                localStorage.setItem('winnersCache', JSON.stringify(data));
            } catch (err) {
                console.error("Fetch error:", err);
                setError("Failed to fetch latest winners from server.");
            }
        };

        fetchWinners();
    }, []);

    if (error) return <Alert variant="danger" className="mt-5 text-center">{error}</Alert>;

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
                    let winnerVariant = "text-success";

                    if (!hasZeroVotes) {
                        const tiedNominees = item.fullTally.filter(nom => nom.voteCount === maxVotes);
                        if (tiedNominees.length > 1) {
                            winnerStatus = "TIE!";
                            winnerName = tiedNominees.map(nom => nom.name).join(' & ');
                            winnerVariant = "text-warning";
                        }
                    }

                    const votedNominees = item.fullTally
                        .filter(nom => nom.voteCount > 0)
                        .sort((a, b) => b.voteCount - a.voteCount);

                    return (
                        <Col md={6} lg={4} key={index} className="mb-4 d-flex">
                            <Card className="shadow-lg h-100 w-100 border-success">
                                <Card.Header as="h3" className="bg-success text-white py-3">
                                    {item.categoryName}
                                </Card.Header>
                                <Card.Body>
                                    {hasZeroVotes ? (
                                        <p className="text-danger lead">🗳️ No Votes Recorded Yet</p>
                                    ) : (
                                        <>
                                            <p className={`lead mb-0 ${winnerVariant} d-flex align-items-center`}>
                                                <span className="me-2">{winnerStatus === "TIE!" ? '🤝' : '🏆'}</span>
                                                {winnerStatus}: <span className="fw-bolder ms-1">{winnerName}</span>
                                            </p>
                                            <small className="text-muted">Total Votes: {maxVotes}</small>
                                        </>
                                    )}
                                </Card.Body>
                                <Card.Footer className="bg-light">
                                    <details>
                                        <summary className="fw-bold text-primary">Full Vote Breakdown ({votedNominees.length} Nominees Voted)</summary>
                                        <ListGroup variant="flush" className="mt-2 border rounded">
                                            {votedNominees.map(nom => (
                                                <ListGroup.Item key={nom.id} className="d-flex justify-content-between align-items-center p-2">
                                                    <span className={(!hasZeroVotes && nom.voteCount === maxVotes) ? 'fw-bold text-success' : ''}>
                                                        {nom.name} 
                                                    </span>
                                                    <span className={`badge ${(!hasZeroVotes && nom.voteCount === maxVotes) ? 'bg-success' : 'bg-secondary'}`}>
                                                        {nom.voteCount} Votes
                                                    </span>
                                                </ListGroup.Item>
                                            ))}
                                            {votedNominees.length === 0 && <p className="text-muted mt-2 mb-0">No votes recorded yet.</p>}
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
