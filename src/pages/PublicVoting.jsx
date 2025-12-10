import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Spinner, Row, Col } from 'react-bootstrap';
import Swal from 'sweetalert2';

// Component for sign-in (replaces the separate SignIn.jsx)
const VoterSignIn = ({ onSignedIn }) => {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
    // NEW STATE: Loading state for the sign-in button
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); // Start loading
        try {
            const response = await fetch('/api/public/signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await response.json();
            
            if (response.ok) {
                // Optional: Show success message before proceeding
                Swal.fire({
                    icon: 'success',
                    title: 'Signed In',
                    text: data.message || 'Sign-in successful.',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    onSignedIn(data.voterId);
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Sign-in Failed',
                    text: data.message || 'Sign-in failed.'
                });
            }
        } catch (error) {
            console.error('Sign-in error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Network Error',
                text: 'Unable to connect to the server.'
            });
        } finally {
            setLoading(false); // Stop loading regardless of success/fail
        }
    };

    return (
        <Card className="shadow-lg p-4 mx-auto" style={{ maxWidth: '500px' }}>
            <Card.Title className="text-center text-primary">Voter Sign-In</Card.Title>
            <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3"><Form.Control name="name" type="text" placeholder="Full Name" onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></Form.Group>
                <Form.Group className="mb-3"><Form.Control name="email" type="email" placeholder="Email Address" onChange={(e) => setFormData({ ...formData, email: e.target.value })} required /></Form.Group>
                <Form.Group className="mb-4"><Form.Control name="phone" type="tel" placeholder="Phone Number" onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required /></Form.Group>
                
                <Button 
                    variant="primary" 
                    type="submit" 
                    className="w-100"
                    disabled={loading} // Disable button while loading
                >
                    {loading ? ( // Show spinner or text based on loading state
                        <>
                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                            Loading...
                        </>
                    ) : (
                        "Start Voting"
                    )}
                </Button>
            </Form>
        </Card>
    );
};

// Main Voting Area
function PublicVoting({ voterId, onSignedIn }) {
    const [data, setData] = useState([]); // Array of categories with nested nominees
    const [selectedVotes, setSelectedVotes] = useState({});
    const [loading, setLoading] = useState(true);
    // REMOVED: statusMessage state (replaced by SweetAlert)
    
    // NEW STATE: Stores existing votes fetched from the server. Key: categoryId, Value: nomineeId
    const [votedCategories, setVotedCategories] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            if (!voterId) return setLoading(false);
            setLoading(true);
            try {
                // 1. Fetch Categories and Nominees
                const catResponse = await fetch('/api/public/categories-nominees');
                const categories = await catResponse.json();
                setData(categories);

                // 2. Fetch Existing Votes for the signed-in voter
                const votesResponse = await fetch(`/api/public/voter-votes/${voterId}`);
                const existingVotes = await votesResponse.json(); 
                
                // FIX: Use snake_case keys from the backend response
                const votesMap = existingVotes.reduce((acc, vote) => {
                    acc[vote.category_id] = vote.nominee_id; // <-- CORRECTED KEYS
                    return acc;
                }, {});

                setVotedCategories(votesMap);
                setSelectedVotes(votesMap); // Initialize selectedVotes with existing votes

            } catch (err) {
                console.error('Error fetching data or existing votes:', err);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error loading data or existing votes.'
                });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [voterId]);

    if (!voterId) return <Container className="my-5"><VoterSignIn onSignedIn={onSignedIn} /></Container>;
    if (loading) return <Spinner animation="border" className="d-block mx-auto mt-5" />;

    const handleSubmitVote = async (categoryId) => {
        const nomineeId = selectedVotes[categoryId];
        if (!nomineeId) return;

        // Show loading alert
        Swal.fire({
            title: `Submitting vote...`,
            text: `Category ID: ${categoryId}`,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        try {
            const response = await fetch('/api/public/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voterId, categoryId, nomineeId }),
            });

            const result = await response.json();
            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: result.message
                });
                
                // SUCCESS: Update votedCategories to show it's done
                setVotedCategories(prev => ({
                    ...prev,
                    [categoryId]: nomineeId 
                }));
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Vote Failed',
                    text: result.message || 'Vote failed.'
                });
                
                // ALREADY VOTED: If the backend confirms double vote, update the local state correctly
                if (result.message && result.message.toLowerCase().includes('already voted')) {
                    if (selectedVotes[categoryId]) {
                        setVotedCategories(prev => ({
                            ...prev,
                            [categoryId]: selectedVotes[categoryId]
                        }));
                    }
                }
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Network error during vote submission.'
            });
        }
    };

    return (
        <Container className="my-5">
            <h2 className="text-center mb-4 text-info">🗳️ Cast Your Votes</h2>
            {/* REMOVED: Alert Component */}

            <Row>
                {data.map(category => {
                    const hasVoted = !!votedCategories[category.id];
                    const winningNomineeId = votedCategories[category.id];
                    
                    return (
                        <Col md={6} lg={4} key={category.id} className="mb-4">
                        <Card className="shadow-sm h-100">
                            <Card.Header as="h5" className="bg-light text-dark">
                                {category.name}
                                {hasVoted && <span className="badge bg-success float-end">VOTED</span>}
                            </Card.Header>
                            <Card.Body>
                                {/* START: Category Description Added Here */}
                                {category.description && (
                                    <p className="text-muted small border-bottom pb-2 mb-3">
                                        **Criteria:** {category.description}
                                    </p>
                                )}
                                {/* END: Category Description Added Here */}
                                <Form>
                                    {category.nominees.map(nominee => (
                                        <Form.Check
                                            key={nominee.id}
                                            type="radio"
                                            id={`vote-${nominee.id}`}
                                            name={`vote-category-${category.id}`}
                                            label={nominee.name}
                                            className="mb-2"
                                            // Check the box if the user has voted and this is the winning nominee, OR if it's the current selection
                                            checked={hasVoted ? (nominee.id === winningNomineeId) : (selectedVotes[category.id] === nominee.id)}
                                            // Disable radio buttons if the user has already voted
                                            disabled={hasVoted}
                                            onChange={() => !hasVoted && setSelectedVotes(prev => ({ ...prev, [category.id]: nominee.id }))}
                                        />
                                    ))}
                                    <Button 
                                        variant={hasVoted ? "success" : "primary"}
                                        size="sm" 
                                        className="mt-3 w-100"
                                            // Disable the button if voted or if no selection has been made
                                        disabled={hasVoted || !selectedVotes[category.id]}
                                        onClick={() => handleSubmitVote(category.id)}
                                    >
                                        {hasVoted ? "Vote Submitted" : "Submit Vote"}
                                    </Button>
                                </Form>
                            </Card.Body>
                        </Card>
                        </Col>
                    );
                })}
            </Row>
        </Container>
    );
}

export default PublicVoting;