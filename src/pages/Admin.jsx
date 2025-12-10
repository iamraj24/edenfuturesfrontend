import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Card, Table, Spinner } from 'react-bootstrap';
import Swal from 'sweetalert2'; // Swal is imported and will be used for all alerts

// 🔗 API CONFIGURATION
// Reads the external backend URL from Vercel's environment variables (VITE_API_BASE_URL).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''; 

// NOTE: Replace this with a proper login/session token mechanism in production
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY; 

// Helper function to display SweetAlerts easily
const showSwal = (icon, title, text) => {
    Swal.fire({
        icon: icon,
        title: title,
        text: text,
        showConfirmButton: true, // Keep confirmation button for errors/warnings
    });
};

// Accept isAdmin and onLogin as props
function AdminPage({ isAdmin, onLogin }) {
    const [categories, setCategories] = useState([]);
    const [newCatName, setNewCatName] = useState('');
    const [newNominee, setNewNominee] = useState({ name: '', category_id: '' });
    // NEW STATE: For managing category description input
    const [newDescription, setNewDescription] = useState({ description: '', category_id: '' });
    
    const [loading, setLoading] = useState(false);
    // REMOVED: status state, as SweetAlert will now handle all transient messages

    useEffect(() => {
        // Only fetch categories if the admin is actually logged in
        if (isAdmin) {
            fetchCategories();
        }
    }, [isAdmin]);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            // >>> URL FIX HERE: Added API_BASE_URL
            const response = await fetch(`${API_BASE_URL}/api/admin/categories`, {
                headers: { 'X-Admin-Key': ADMIN_KEY }
            });
            if (!response.ok) {
                showSwal('error', 'Load Failed', `Failed to load categories. Status: ${response.status}`);
                setLoading(false);
                return;
            }
            const cats = await response.json();

            // 2) fetch nominees separately from the nominees table
            let nominees = [];
            try {
                // >>> URL FIX HERE: Added API_BASE_URL
                const nomResp = await fetch(`${API_BASE_URL}/api/admin/nominees`, {
                    headers: { 'X-Admin-Key': ADMIN_KEY }
                });
                if (nomResp.ok) {
                    nominees = await nomResp.json();
                } else {
                    // If nominees endpoint fails, still show categories but warn
                    showSwal('warning', 'Nominees Load', `Failed to load nominees. Status: ${nomResp.status}`);
                }
            } catch (err) {
                showSwal('warning', 'Nominees Network', 'Network error fetching nominees. Categories loaded without nominees.');
            }

            // Helper to safely read a nominee's category id (handles different shapes)
            const getNomCategoryId = (n) => {
                if (n == null) return undefined;
                return n.category_id ?? n.categoryId ?? (n.category ? (n.category.id ?? n.categoryId) : undefined);
            };

            // 3) merge nominees into their categories by comparing category_id
            const catsWithNominees = (cats || []).map(cat => {
                const catIdStr = String(cat.id);
                const matched = (nominees || []).filter(n => {
                    const nCat = getNomCategoryId(n);
                    return String(nCat) === catIdStr;
                });
                return { ...cat, nominees: matched };
            });

            setCategories(catsWithNominees);
        } catch (error) {
            showSwal('error', 'Network Error', 'Network error fetching categories.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        Swal.fire({ title: 'Adding category...', text: 'Please wait.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            // >>> URL FIX HERE: Added API_BASE_URL
            const response = await fetch(`${API_BASE_URL}/api/admin/categories`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Admin-Key': ADMIN_KEY 
                },
                body: JSON.stringify({ name: newCatName }),
            });
            if (response.ok) {
                const newCategory = await response.json();
                setCategories([...categories, newCategory]);
                setNewCatName('');
                showSwal('success', 'Success', `Category "${newCategory.name}" added successfully!`);
            } else {
                const errorData = await response.json();
                showSwal('error', 'Failed', `Failed: ${errorData.message}`);
            }
        } catch (error) {
            showSwal('error', 'Network Error', 'Network error adding category.');
        }
    };

    // NEW FUNCTION: Handle adding or updating category description
    const handleAddDescription = async (e) => {
        e.preventDefault();
        if (!newDescription.category_id) {
            return showSwal('warning', 'Input Required', 'Please select a category.');
        }
        Swal.fire({ title: 'Updating description...', text: 'Please wait.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // Find the category being updated to potentially merge the new description locally
        const categoryToUpdate = categories.find(cat => String(cat.id) === String(newDescription.category_id));

        try {
            // >>> URL FIX HERE: Added API_BASE_URL and dynamic ID
            const response = await fetch(`${API_BASE_URL}/api/admin/categories/${newDescription.category_id}`, {
                method: 'PATCH', // Using PATCH for partial update
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Key': ADMIN_KEY
                },
                body: JSON.stringify({ description: newDescription.description }),
            });

            if (response.ok) {
                // Update local state to reflect the new description
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


    const handleAddNominee = async (e) => {
        e.preventDefault();
        if (!newNominee.category_id) {
            return showSwal('warning', 'Input Required', 'Please select a category.');
        }
        Swal.fire({ title: 'Adding nominee...', text: 'Please wait.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            // >>> URL FIX HERE: Added API_BASE_URL
            const response = await fetch(`${API_BASE_URL}/api/admin/nominees`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Admin-Key': ADMIN_KEY 
                },
                body: JSON.stringify(newNominee),
            });
            if (response.ok) {
                const newNom = await response.json();
                setNewNominee({ name: '', category_id: '' });
                // NOTE: Nominee addition doesn't automatically update the list of nominees nested inside categories, 
                // a manual fetch/refresh would be better, but we update the local state to reflect the new nominee immediately.
                setCategories(prev => prev.map(cat => 
                    String(cat.id) === String(newNom.category_id) 
                    ? { ...cat, nominees: [...(cat.nominees || []), newNom] } 
                    : cat
                ));
                showSwal('success', 'Success', `Nominee "${newNom.name}" added successfully!`);
            } else {
                const errorData = await response.json();
                showSwal('error', 'Failed', `Failed: ${errorData.message}`);
            }
        } catch (error) {
            showSwal('error', 'Network Error', 'Network error adding nominee.');
        }
    };

    // ---------- New: Edit / Delete handlers for categories & nominees ----------

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
            // >>> URL FIX HERE: Added API_BASE_URL and dynamic ID
            const response = await fetch(`${API_BASE_URL}/api/admin/categories/${cat.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY },
                body: JSON.stringify({ name: newName }),
            });
            if (response.ok) {
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
            text: "This will remove the category and its nominees (if backend deletes cascade).",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it',
        });
        if (!result.isConfirmed) return;

        Swal.fire({ title: 'Deleting...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            // >>> URL FIX HERE: Added API_BASE_URL and dynamic ID
            const response = await fetch(`${API_BASE_URL}/api/admin/categories/${cat.id}`, {
                method: 'DELETE',
                headers: { 'X-Admin-Key': ADMIN_KEY }
            });
            if (response.ok) {
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

    const handleEditNominee = async (nom, categoryId) => {
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
            // >>> URL FIX HERE: Added API_BASE_URL and dynamic ID
            const response = await fetch(`${API_BASE_URL}/api/admin/nominees/${nom.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY },
                body: JSON.stringify({ name: newName }),
            });
            if (response.ok) {
                setCategories(prev => prev.map(cat => {
                    if (String(cat.id) !== String(categoryId)) return cat;
                    return {
                        ...cat,
                        nominees: (cat.nominees || []).map(n => String(n.id) === String(nom.id) ? { ...n, name: newName } : n)
                    };
                }));
                showSwal('success', 'Updated', `Nominee updated to "${newName}".`);
            } else {
                const err = await response.json();
                showSwal('error', 'Failed', `Failed: ${err.message}`);
            }
        } catch (error) {
            showSwal('error', 'Network Error', 'Network error updating nominee.');
        }
    };

    const handleDeleteNominee = async (nom, categoryId) => {
        const result = await Swal.fire({
            title: `Delete nominee "${nom.name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete',
        });
        if (!result.isConfirmed) return;

        Swal.fire({ title: 'Deleting nominee...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            // >>> URL FIX HERE: Added API_BASE_URL and dynamic ID
            const response = await fetch(`${API_BASE_URL}/api/admin/nominees/${nom.id}`, {
                method: 'DELETE',
                headers: { 'X-Admin-Key': ADMIN_KEY }
            });
            if (response.ok) {
                setCategories(prev => prev.map(cat => {
                    if (String(cat.id) !== String(categoryId)) return cat;
                    return { ...cat, nominees: (cat.nominees || []).filter(n => String(n.id) !== String(nom.id)) };
                }));
                showSwal('success', 'Deleted', `Nominee "${nom.name}" deleted.`);
            } else {
                const err = await response.json();
                showSwal('error', 'Failed', `Failed: ${err.message}`);
            }
        } catch (error) {
            showSwal('error', 'Network Error', 'Network error deleting nominee.');
        }
    };

    // Login Form States
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [passwordVisible, setPasswordVisible] = useState(false);

    const togglePasswordVisibility = () => {
        setPasswordVisible(prev => !prev);
    };

    const Login=(e)=>{
        e.preventDefault();
        if(username == "edennn" && password == "edennn432"){
            // 🔑 Store a flag in local storage upon successful login
            localStorage.setItem('isAdminLoggedIn', 'true');
            
            // Call the parent function provided via props instead of local state
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

    // Flatten nominees for the separate nominees table (attach category info)
    const flatNominees = categories.flatMap(cat => (cat.nominees || []).map(n => ({
        ...n,
        categoryName: cat.name,
        categoryId: cat.id
    })));

    return (
        <>
            {/* Use isAdmin prop to control rendering */}
            {isAdmin == true ?(
            <Container className="my-5">
            <h2 className="text-center mb-4 text-warning">Admin Dashboard</h2>
            {/* REMOVED: Alert component. All messages are now handled by Swal.fire */}
            
            {loading && <Spinner animation="border" className="d-block mx-auto my-5" />}

            <Row>
                {/* 1. Create Category Card (Col md={4} for three-column layout) */}
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

                {/* NEW CARD: Add Description (Col md={4} for three-column layout) */}
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

                {/* 3. Add Nominee Card (Col md={4} for three-column layout) */}
                <Col md={4} className="mb-4">
                    <Card className="shadow-lg h-100">
                        <Card.Header as="h4" className="bg-dark text-white">Add Nominee</Card.Header>
                        <Card.Body>
                            <Form onSubmit={handleAddNominee}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Select Category</Form.Label>
                                    <Form.Select
                                        value={newNominee.category_id}
                                        onChange={(e) => setNewNominee({ ...newNominee, category_id: e.target.value })}
                                        required
                                    >
                                        <option value="">-- Choose Category --</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
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

            {/* ----------------- Nominees Table ----------------- */}
            <Card className="shadow-lg mt-4">
                <Card.Header as="h4" className="bg-info text-white">Nominees</Card.Header>
                <Card.Body className="p-0">
                    {flatNominees.length > 0 ? (
                        <Table striped hover responsive className="mb-0">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Nominee</th>
                                    <th>Category</th>
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
                                        <td>{nom.categoryName ?? <em className="text-muted">Unknown</em>}</td>
                                        <td>
                                            <div className="d-flex">
                                                <Button size="sm" variant="outline-primary" className="me-2" onClick={() => handleEditNominee(nom, nom.categoryId)}>Edit</Button>
                                                <Button size="sm" variant="outline-danger" onClick={() => handleDeleteNominee(nom, nom.categoryId)}>Delete</Button>
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
                            // Toggle between 'password' (dots) and 'text' (visible)
                            type={passwordVisible ? "text" : "password"} 
                            className="form-control border border-3" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            id="floatingPassword" 
                            placeholder="Password" 
                        />
                        <label htmlFor="floatingPassword">Password</label>

                        {/* 3. The Toggle Button */}
                        <button
                                type="button"
                            className="btn position-absolute  end-0 me-2 "
                            style={{ zIndex: 100, background: 'transparent', border: 'none', marginTop:"-50px" }}
                            onClick={togglePasswordVisibility}
                        >
                            {/* Simple text/emoji icon */}
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