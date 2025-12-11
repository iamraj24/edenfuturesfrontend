import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Card, Table, Spinner } from 'react-bootstrap';
import Swal from 'sweetalert2'; 

// 🔗 API CONFIGURATION
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''; 

// NOTE: Replace this with a proper login/session token mechanism in production
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY; 

// Helper function to display SweetAlerts easily
const showSwal = (icon, title, text) => {
    Swal.fire({
        icon: icon,
        title: title,
        text: text,
        showConfirmButton: true, 
    });
};

function AdminPage({ isAdmin, onLogin }) {
    const [categories, setCategories] = useState([]);
    const [allNominees, setAllNominees] = useState([]); // Store all unique nominees globally
    const [newCatName, setNewCatName] = useState('');
    const [newNominee, setNewNominee] = useState({ name: '' });
    const [newDescription, setNewDescription] = useState({ description: '', category_id: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isAdmin) {
            fetchCategoriesAndNominees();
        }
    }, [isAdmin]);

    // 🎯 UPDATED: The fetch logic now assumes a true M:M structure:
    // 1. Fetch Categories
    // 2. Fetch ALL Nominees (unique entities)
    // 3. Fetch ALL Nominations (the join table links)
    // 4. Stitch the data together (This is complex due to your hybrid API)
    const fetchCategoriesAndNominees = async () => {
        setLoading(true);
        try {
            // 1. Fetch Categories
            const catResp = await fetch(`${API_BASE_URL}/api/admin/categories`, {
                headers: { 'X-Admin-Key': ADMIN_KEY }
            });
            const cats = catResp.ok ? await catResp.json() : [];
            if (!catResp.ok) throw new Error(`Category load failed: ${catResp.status}`);

            // 2. Fetch ALL Nominees (Should be unique by name/ID now)
            // Assuming this endpoint now returns a flat list of unique nominees
            const nomResp = await fetch(`${API_BASE_URL}/api/admin/nominees`, {
                headers: { 'X-Admin-Key': ADMIN_KEY }
            });
            const nominees = nomResp.ok ? await nomResp.json() : [];
            // NOTE: If your /api/admin/nominees still returns duplicated nominee entries
            // (one per category), the logic below will need to deduplicate them for the 
            // `allNominees` state. For now, we use a simple set of unique names/IDs.
            
            // 3. Fetch ALL Nominations (The join links)
            const nomLinkResp = await fetch(`${API_BASE_URL}/api/admin/nominations`, {
                headers: { 'X-Admin-Key': ADMIN_KEY }
            });
            const nominations = nomLinkResp.ok ? await nomLinkResp.json() : [];

            // --- 4. Stitching Logic (M:M Frontend Simulation) ---
            const nomineeMap = new Map();
            nominees.forEach(n => nomineeMap.set(n.id, n));
            
            // Group nominations by category_id
            const catNomineeLinks = new Map();
            nominations.forEach(link => {
                if (!catNomineeLinks.has(link.category_id)) {
                    catNomineeLinks.set(link.category_id, []);
                }
                const nominee = nomineeMap.get(link.nominee_id);
                if (nominee) {
                    catNomineeLinks.get(link.category_id).push(nominee);
                }
            });

            // Map nominees to categories
            const catsWithNominees = (cats || []).map(cat => ({
                ...cat,
                nominees: catNomineeLinks.get(cat.id) || []
            }));

            // Deduplicate for the master list
            const uniqueNominees = Array.from(nomineeMap.values());

            setCategories(catsWithNominees);
            setAllNominees(uniqueNominees); // Use the global list of unique nominees

        } catch (error) {
            console.error(error);
            showSwal('error', 'Load Failed', `Failed to load data: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };
    
    // 🎯 UPDATED: Add Category now links all existing UNIQUE Nominees (using allNominees state)
    const handleAddCategory = async (e) => {
        e.preventDefault();
        Swal.fire({ title: 'Adding category...', text: 'Please wait.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            // 1. Create the Category
            const response = await fetch(`${API_BASE_URL}/api/admin/categories`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Admin-Key': ADMIN_KEY 
                },
                body: JSON.stringify({ name: newCatName }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                showSwal('error', 'Failed', `Failed: ${errorData.message}`);
                return;
            }
            const newCategory = await response.json();
            
            // 2. Link all existing UNIQUE nominees to the new category
            const linkPromises = allNominees.map(nominee => 
                fetch(`${API_BASE_URL}/api/admin/nominations`, { // Assuming a new endpoint for linking
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Key': ADMIN_KEY 
                    },
                    body: JSON.stringify({ 
                        category_id: newCategory.id, 
                        nominee_id: nominee.id 
                    }),
                })
            );

            await Promise.all(linkPromises);
            
            // 3. Update State
            setCategories(prev => [...prev, { ...newCategory, nominees: allNominees }]);
            setNewCatName('');
            showSwal('success', 'Success', `Category "${newCategory.name}" added and linked to ${allNominees.length} existing nominees!`);

        } catch (error) {
            console.error(error);
            showSwal('error', 'Network Error', 'Network error adding category or linking nominees.');
        }
    };
    
    // This function is fine as it updates only the Category table.
    const handleAddDescription = async (e) => {
        e.preventDefault();
        if (!newDescription.category_id) {
            return showSwal('warning', 'Input Required', 'Please select a category.');
        }
        Swal.fire({ title: 'Updating description...', text: 'Please wait.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const categoryToUpdate = categories.find(cat => String(cat.id) === String(newDescription.category_id));

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/categories/${newDescription.category_id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Key': ADMIN_KEY
                },
                body: JSON.stringify({ description: newDescription.description }),
            });

            if (response.ok) {
                if (categoryToUpdate) {
                    setCategories(categories.map(cat => 
                        String(cat.id) === String(newDescription.category_id) 
                        ? { ...cat, description: newDescription.description } 
                        : cat
                    ));
                }
                setNewDescription({ description: '', category_id: '' });
                showSwal('success', 'Success', `Description for "${categoryToUpdate?.name || 'Category'}" updated successfully!`);
            } else {
                const errorData = await response.json();
                showSwal('error', 'Failed', `Failed: ${errorData.message}`);
            }
        } catch (error) {
            showSwal('error', 'Network Error', 'Network error updating description.');
        }
    };

    // 🎯 UPDATED: Add Nominee now creates ONE Nominee entity and multiple Nomination links.
    const handleAddNominee = async (e) => {
        e.preventDefault();
        if (!newNominee.name) {
            return showSwal('warning', 'Input Required', 'Please enter a nominee name.');
        }
        if (categories.length === 0) {
            return showSwal('warning', 'No Categories', 'Please create a category first.');
        }

        Swal.fire({ title: `Adding nominee "${newNominee.name}"...`, text: 'Please wait.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        try {
            // 1. Create the unique Nominee record
            const nomineeCreation = await fetch(`${API_BASE_URL}/api/admin/nominees`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY },
                body: JSON.stringify({ name: newNominee.name }), // Only send the name
            });
            
            if (!nomineeCreation.ok) {
                const errorData = await nomineeCreation.json();
                // Check if it's a unique constraint error (nominee already exists by name)
                if (nomineeCreation.status === 409) { 
                     return showSwal('warning', 'Already Exists', `Nominee "${newNominee.name}" already exists. Cannot add.`);
                }
                throw new Error(errorData.message || 'Failed to create nominee entity.');
            }
            const createdNominee = await nomineeCreation.json();

            // 2. Link the new nominee to ALL categories using the nominations endpoint
            const linkPromises = categories.map(cat => 
                fetch(`${API_BASE_URL}/api/admin/nominations`, { // Assuming an endpoint for creating a link
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Key': ADMIN_KEY 
                    },
                    body: JSON.stringify({ 
                        category_id: cat.id, 
                        nominee_id: createdNominee.id 
                    }),
                })
            );

            await Promise.all(linkPromises);

            // 3. Update local state: Add to the allNominees list and all category lists
            setAllNominees(prev => [...prev, createdNominee]);
            setCategories(prev => prev.map(cat => ({
                ...cat,
                nominees: [...(cat.nominees || []), createdNominee]
            })));

            setNewNominee({ name: '' });
            showSwal('success', 'Success', `Nominee "${newNominee.name}" added and linked to all categories!`);

        } catch (error) {
            console.error(error);
            showSwal('error', 'Network Error', `Error adding nominee: ${error.message}`);
        }
    };

    // ---------- Edit / Delete handlers ----------

    // Category handlers are fine as they only touch the Category table
    const handleEditCategory = async (cat) => {
        const { value: newName } = await Swal.fire({
            title: 'Edit Category Name',
            input: 'text',
            inputLabel: 'Category Name',
            inputValue: cat.name || '',
            showCancelButton: true,
        });

        if (!newName) return;

        Swal.fire({ title: 'Updating category...', text: 'Please wait.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/categories/${cat.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY },
                body: JSON.stringify({ name: newName }),
            });
            if (response.ok) {
                // Update category name in all places
                setCategories(prev => prev.map(c => String(c.id) === String(cat.id) ? { ...c, name: newName } : c));
                showSwal('success', 'Updated', `Category name updated to "${newName}".`);
            } else {
                const err = await response.json();
                showSwal('error', 'Failed', `Failed: ${err.message}`);
            }
        } catch (error) {
            showSwal('error', 'Network Error', 'Network error updating category.');
        }
    };

    const handleDeleteCategory = async (cat) => {
        const result = await Swal.fire({
            title: `Delete category "${cat.name}"?`,
            text: "This will remove the category and all its associated nominations (but not the nominees themselves).",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it',
        });
        if (!result.isConfirmed) return;

        Swal.fire({ title: 'Deleting...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/categories/${cat.id}`, {
                method: 'DELETE',
                headers: { 'X-Admin-Key': ADMIN_KEY }
            });
            if (response.ok) {
                // Remove category from state
                setCategories(prev => prev.filter(c => String(c.id) !== String(cat.id)));
                showSwal('success', 'Deleted', `Category "${cat.name}" deleted.`);
            } else {
                const err = await response.json();
                showSwal('error', 'Failed', `Failed: ${err.message}`);
            }
        } catch (error) {
            showSwal('error', 'Network Error', 'Network error deleting category.');
        }
    };

    // 🎯 UPDATED: Edit Nominee now updates the single Nominee entity name.
    const handleEditNominee = async (nom) => {
        const { value: newName } = await Swal.fire({
            title: 'Edit Nominee Name',
            input: 'text',
            inputLabel: 'Nominee Name',
            inputValue: nom.name || '',
            showCancelButton: true,
        });

        if (!newName) return;

        Swal.fire({ title: 'Updating nominee...', text: 'Please wait.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/nominees/${nom.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY },
                body: JSON.stringify({ name: newName }),
            });
            if (response.ok) {
                // Update name in both the master list and all category lists
                setAllNominees(prev => prev.map(n => String(n.id) === String(nom.id) ? { ...n, name: newName } : n));
                setCategories(prev => prev.map(cat => ({
                    ...cat,
                    nominees: (cat.nominees || []).map(n => String(n.id) === String(nom.id) ? { ...n, name: newName } : n)
                })));
                showSwal('success', 'Updated', `Nominee name updated to "${newName}".`);
            } else {
                const err = await response.json();
                showSwal('error', 'Failed', `Failed: ${err.message}`);
            }
        } catch (error) {
            showSwal('error', 'Network Error', 'Network error updating nominee.');
        }
    };

    // 🎯 UPDATED: Delete Nominee now removes the single Nominee entity AND all its links.
    const handleDeleteNominee = async (nom) => {
        const result = await Swal.fire({
            title: `Delete nominee "${nom.name}"?`,
            text: "This will delete the nominee from ALL categories and the main nominee list.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete permanently',
        });
        if (!result.isConfirmed) return;

        Swal.fire({ title: 'Deleting nominee...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            // Delete the unique nominee entity. Due to CASCADE DELETE on the DB, this should 
            // automatically clean up all associated 'nominations' and 'votes'.
            const response = await fetch(`${API_BASE_URL}/api/admin/nominees/${nom.id}`, {
                method: 'DELETE',
                headers: { 'X-Admin-Key': ADMIN_KEY }
            });
            if (response.ok) {
                // Remove from the master list
                setAllNominees(prev => prev.filter(n => String(n.id) !== String(nom.id)));
                // Remove from all category lists
                setCategories(prev => prev.map(cat => ({ 
                    ...cat, 
                    nominees: (cat.nominees || []).filter(n => String(n.id) !== String(nom.id)) 
                })));

                showSwal('success', 'Deleted', `Nominee "${nom.name}" deleted permanently.`);
            } else {
                const err = await response.json();
                showSwal('error', 'Failed', `Failed: ${err.message}`);
            }
        } catch (error) {
            showSwal('error', 'Network Error', 'Network error deleting nominee.');
        }
    };
    
    // Login Logic (remains unchanged)
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [passwordVisible, setPasswordVisible] = useState(false);

    const togglePasswordVisibility = () => {
        setPasswordVisible(prev => !prev);
    };

    const Login=(e)=>{
        e.preventDefault();
        if(username == "edennn" && password == "edennn432"){
            localStorage.setItem('isAdminLoggedIn', 'true');
            onLogin();
        }else{
            Swal.fire({
                icon: 'error', 
                title: 'Authentication Failed',
                text: 'Incorrect Username or Password. Please try again.',
                confirmButtonText: 'OK',
            });
            return;
        }
    }
    
    // Flat list is now just `allNominees` for the table display
    const flatNominees = allNominees;

    return (
        <>
            {isAdmin == true ?(
            <Container className="my-5">
            <h2 className="text-center mb-4 text-warning">Admin Dashboard</h2>
            
            {loading && <Spinner animation="border" className="d-block mx-auto my-5" />}

            <Row>
                {/* 1. Create Category Card */}
                <Col md={4} className="mb-4">
                    <Card className="shadow-lg h-100">
                        <Card.Header as="h4" className="bg-dark text-white">Create Category</Card.Header>
                        <Card.Body>
                            <Form onSubmit={handleAddCategory}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Category Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={newCatName}
                                        onChange={(e) => setNewCatName(e.target.value)}
                                        placeholder="e.g., Best New Innovation"
                                        required
                                    />
                                </Form.Group>
                                <Button variant="warning" type="submit" className="w-100">
                                    Add Category
                                </Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>

                {/* 2. Add Description Card */}
                <Col md={4} className="mb-4">
                    <Card className="shadow-lg h-100">
                        <Card.Header as="h4" className="bg-dark text-white">Add Description</Card.Header>
                        <Card.Body>
                            <Form onSubmit={handleAddDescription}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Select Category</Form.Label>
                                    <Form.Select
                                        value={newDescription.category_id}
                                        onChange={(e) => setNewDescription({ ...newDescription, category_id: e.target.value })}
                                        required
                                    >
                                        <option value="">-- Choose Category --</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Category Description</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={3}
                                        value={newDescription.description}
                                        onChange={(e) => setNewDescription({ ...newDescription, description: e.target.value })}
                                        placeholder="Briefly describe the criteria for this category."
                                        required
                                    />
                                </Form.Group>
                                <Button variant="info" type="submit" className="w-100">
                                    Update Description
                                </Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>

                {/* 3. Add Nominee Card (Updated for M:M) */}
                <Col md={4} className="mb-4">
                    <Card className="shadow-lg h-100">
                        <Card.Header as="h4" className="bg-dark text-white">Add Nominee Entity</Card.Header>
                        <Card.Body>
                            <Form onSubmit={handleAddNominee}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Nominee Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={newNominee.name}
                                        onChange={(e) => setNewNominee({ ...newNominee, name: e.target.value })}
                                        placeholder="e.g., Project Nova"
                                        required
                                    />
                                </Form.Group>
                                <div className="text-muted small mb-3">
                                    * This creates a **unique nominee entity** and links it to **ALL** existing categories.
                                </div>
                                <Button variant="success" type="submit" className="w-100">
                                    Add Nominee
                                </Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
            
            {/* ----------------- Categories Table ----------------- */}
            <Card className="shadow-lg mt-4">
                <Card.Header as="h4" className="bg-info text-white">Categories</Card.Header>
                <Card.Body className="p-0">
                    {categories.length > 0 ? (
                        <Table striped hover responsive className="mb-0">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Category Name</th>
                                    <th>Description</th>
                                    <th>Nominees Count</th> {/* Added Nominee Count */}
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map((cat, idx) => (
                                    <tr key={cat.id}>
                                        <td>{idx + 1}</td>
                                        <td>
                                            <strong>{cat.name}</strong>
                                            <div className="text-muted" style={{ fontSize: '0.8em' }}>ID: {String(cat.id).substring(0,8)}...</div>
                                        </td>
                                        <td>
                                            {cat.description ? <span style={{ fontSize: '0.95em' }}>{cat.description}</span> : <em className="text-muted">No description</em>}
                                        </td>
                                        <td>
                                            {/* Display the count of linked nominees */}
                                            {cat.nominees?.length || 0}
                                        </td>
                                        <td>
                                            <div className="d-flex">
                                                <Button size="sm" variant="outline-info" className="me-2" onClick={() => handleEditCategory(cat)}>Edit</Button>
                                                <Button size="sm" variant="outline-danger" onClick={() => handleDeleteCategory(cat)}>Delete</Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    ) : (
                        <div className="p-3">No categories found.</div>
                    )}
                </Card.Body>
            </Card>

            {/* ----------------- Nominees Table (Now showing UNQIUE Nominee Entities) ----------------- */}
            <Card className="shadow-lg mt-4">
                <Card.Header as="h4" className="bg-info text-white">Unique Nominee Entities</Card.Header>
                <Card.Body className="p-0">
                    {flatNominees.length > 0 ? (
                        <Table striped hover responsive className="mb-0">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Nominee Name</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {flatNominees.map((nom, idx) => (
                                    <tr key={nom.id}>
                                        <td>{idx + 1}</td>
                                        <td>
                                            <strong>{nom.name}</strong>
                                            <div className="text-muted" style={{ fontSize: '0.8em' }}>ID: {String(nom.id).substring(0,8)}...</div>
                                        </td>
                                        <td>
                                            <div className="d-flex">
                                                <Button size="sm" variant="outline-primary" className="me-2" onClick={() => handleEditNominee(nom)}>Edit Name</Button>
                                                <Button size="sm" variant="outline-danger" onClick={() => handleDeleteNominee(nom)}>Delete All</Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    ) : (
                        <div className="p-3">No nominees found.</div>
                    )}
                </Card.Body>
            </Card>
        </Container>
            ):(
                <div className='mx-auto mt-4 shadow p-3' style={{ maxWidth: '500px' }}>
                    <h1 className='text-center text-success'>Login</h1>
                    <form className='container'>
                    <div className="form-floating mb-3">
                        <input type="text" className="form-control border border-3" value={username} onChange={(e)=>setUsername(e.target.value)} id="floatingInput" placeholder="type your username" />
                        <label htmlFor="floatingInput">Username</label>
                        </div> 

                        <div className="form-floating position-relative">
                        <input 
                            type={passwordVisible ? "text" : "password"} 
                            className="form-control border border-3" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            id="floatingPassword" 
                            placeholder="Password" 
                        />
                        <label htmlFor="floatingPassword">Password</label>

                        <button
                            type="button"
                            className="btn position-absolute  end-0 me-2 "
                            style={{ zIndex: 100, background: 'transparent', border: 'none', marginTop:"-50px" }}
                            onClick={togglePasswordVisibility}
                        >
                            {passwordVisible ? '🙈' : '👁️'}
                        </button>
                        <div>
                            <button className='btn btn-success my-3 px-4' onClick={Login}>Login</button>
                        </div>
                        </div>
                    </form>
                </div>
            )} 
        </>
    );
}

export default AdminPage;