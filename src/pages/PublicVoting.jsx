import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Spinner, Row, Col } from 'react-bootstrap';
import Swal from 'sweetalert2';

// 🔗 API CONFIGURATION
// Reads the external backend URL from Vercel's environment variables (VITE_API_BASE_URL).
const API_BASE_URL = import.meta.env.API_BASE_URL || ''; 

// Component for sign-in (replaces the separate SignIn.jsx)
const VoterSignIn = ({ onSignedIn }) => {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
    // NEW STATE: Loading state for the sign-in button
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); // Start loading
        try {
            // >>> URL FIX HERE: Added API_BASE_URL to signin endpoint
            const response = await fetch(`${API_BASE_URL}/api/public/signin`, {
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
                    // Assuming data.voterId exists and is the ID needed for voting
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
            <Card.Title className="text-center text-success">Voter Sign-In</Card.Title>
            <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3"><Form.Control name="name" type="text" placeholder="Full Name" onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></Form.Group>
                <Form.Group className="mb-3"><Form.Control name="email" type="email" placeholder="Email Address" onChange={(e) => setFormData({ ...formData, email: e.target.value })} required /></Form.Group>
                <Form.Group className="mb-4"><Form.Control name="phone" type="tel" placeholder="Phone Number" onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required /></Form.Group>
                
                <Button 
                    variant="success" 
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

// Main Voting Area (Component name corrected to PublicVoting)
const PublicVoting = ({ voterId, onSignedIn }) => {
    const [data, setData] = useState([]); // Array of categories with nested nominees
    const [selectedVotes, setSelectedVotes] = useState({});
    const [loading, setLoading] = useState(true);
    
    // NEW STATE: Stores existing votes fetched from the server. Key: categoryId, Value: nomineeId
    const [votedCategories, setVotedCategories] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            if (!voterId) return setLoading(false);
            setLoading(true);
            try {
                // Fetch Categories and Nominees
                const catResponse = await fetch(`${API_BASE_URL}/api/public/categories-nominees`);
                if (!catResponse.ok) throw new Error('Failed to fetch categories.');
                const categories = await catResponse.json();
                setData(categories);

                // Fetch Existing Votes for this voter
                const votesResponse = await fetch(`${API_BASE_URL}/api/public/voter-votes/${voterId}`);
                if (!votesResponse.ok) throw new Error('Failed to fetch existing votes.');
                const existingVotes = await votesResponse.json(); 
                
                // Map existing votes: category_id -> nominee_id
                const votesMap = existingVotes.reduce((acc, vote) => {
                    // Ensure keys match the backend response format (category_id, nominee_id)
                    acc[vote.category_id] = vote.nominee_id; 
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

    // Render VoterSignIn if no voterId is present
    if (!voterId) return <Container className="my-5"><VoterSignIn onSignedIn={onSignedIn} /></Container>;
    
    // Render loading spinner while fetching data
    if (loading) return <Spinner animation="border" className="d-block mx-auto mt-5" />;
    
    // Check if there are no categories to display a message
    if (data.length === 0) return <h3 className="text-center mt-5">No categories available for voting.</h3>;

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
            // >>> URL FIX HERE: Added API_BASE_URL to vote submission endpoint
            const response = await fetch(`${API_BASE_URL}/api/public/vote`, {
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
                
                // ALREADY VOTED: If the backend confirms double vote, ensure local state is correct
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
            {/* Display voter ID for reference (optional) */}
            <p className="text-center text-muted">Voter ID: **{voterId}**</p>

            <Row>
                {data.map(category => {
                    const hasVoted = !!votedCategories[category.id];
                    
                    return (
                        <Col md={6} lg={4} key={category.id} className="mb-4 d-flex">
                            <Card className="shadow-lg h-100 w-100">
                                <Card.Header as="h5" className={`text-white text-center ${hasVoted ? 'bg-success' : 'bg-secondary'}`}>
                                    {category.name}
                                    {hasVoted && <span className="badge bg-light text-success float-end">VOTED</span>}
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
                                                // 🚀 FIX: Use combined ID for global uniqueness
                                                id={`vote-category-${category.id}-nominee-${nominee.id}`}
                                                
                                                // The name must still be grouped by category.id
                                                name={`vote-category-${category.id}`}
                                                
                                                label={nominee.name}
                                                className="mb-2"
                                                
                                                // Use simplified checked logic
                                                checked={selectedVotes[category.id] === nominee.id}
                                                
                                                // Disable radio buttons if the user has already voted
                                                disabled={hasVoted}
                                                
                                                onChange={() => !hasVoted && setSelectedVotes(prev => ({ ...prev, [category.id]: nominee.id }))}
                                            />
                                        ))}
                                        <Button 
                                            variant={hasVoted ? "primary" : "success"}
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