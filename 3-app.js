// Supabase Configuration
const SUPABASE_URL = "https://nerrlmgipffgrhgfdarw.supabase.co";
const SUPABASE_KEY = "sb_publishable_rb4fSDMRnOZEN1Lk1EXa2Q_t30Ihf_x";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;

// Helper function to show alerts
function showAlert(message, type = 'error') {
    const alertDiv = document.getElementById('alert');
    alertDiv.textContent = message;
    alertDiv.className = `alert ${type} show`;
    setTimeout(() => {
        alertDiv.classList.remove('show');
    }, 3000);
}

// Toggle between Sign In and Sign Up forms
function showAuthForm(formType) {
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    const signinBtn = document.querySelector('.auth-toggle button:first-child');
    const signupBtn = document.querySelector('.auth-toggle button:last-child');

    if (formType === 'signin') {
        signinForm.classList.add('active');
        signupForm.classList.remove('active');
        signinBtn.classList.add('active');
        signupBtn.classList.remove('active');
    } else {
        signupForm.classList.add('active');
        signinForm.classList.remove('active');
        signupBtn.classList.add('active');
        signinBtn.classList.remove('active');
    }
}

// Sign Up Function
async function handleSignUp() {
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    if (!email || !password) {
        showAlert('Please fill in all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showAlert('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });

        if (error) {
            showAlert(error.message, 'error');
        } else {
            showAlert('Account created successfully! Please sign in.', 'success');
            showAuthForm('signin');
            document.getElementById('signupEmail').value = '';
            document.getElementById('signupPassword').value = '';
        }
    } catch (error) {
        showAlert('An error occurred. Please try again.', 'error');
    }
}

// Sign In Function
async function handleSignIn() {
    const email = document.getElementById('signinEmail').value;
    const password = document.getElementById('signinPassword').value;

    if (!email || !password) {
        showAlert('Please fill in all fields', 'error');
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            showAlert(error.message, 'error');
        } else {
            currentUser = data.user;
            showAlert('Signed in successfully!', 'success');
            loadUserFiles();
        }
    } catch (error) {
        showAlert('An error occurred. Please try again.', 'error');
    }
}

// Logout Function
async function handleLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            showAlert(error.message, 'error');
        } else {
            currentUser = null;
            document.getElementById('authSection').style.display = 'block';
            document.getElementById('appSection').classList.remove('active');
            document.getElementById('signinEmail').value = '';
            document.getElementById('signinPassword').value = '';
            showAlert('Logged out successfully!', 'success');
        }
    } catch (error) {
        showAlert('An error occurred during logout.', 'error');
    }
}

// Upload File(s)
async function handleUpload() {
    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;

    if (!files || files.length === 0) {
        showAlert('Please select a file to upload', 'error');
        return;
    }

    const currentSession = await supabaseClient.auth.getSession();
    if (!currentSession.data.session) {
        showAlert('You must be logged in to upload files', 'error');
        return;
    }

    const userId = currentSession.data.session.user.id;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = `${userId}/${Date.now()}_${file.name}`;

        try {
            const { error: uploadError } = await supabaseClient.storage
                .from('files')
                .upload(filePath, file);

            if (uploadError) {
                showAlert(`Failed to upload ${file.name}: ${uploadError.message}`, 'error');
            } else {
                showAlert(`${file.name} uploaded successfully!`, 'success');
            }
        } catch (error) {
            showAlert(`Error uploading ${file.name}`, 'error');
        }
    }

    fileInput.value = '';
    loadUserFiles();
}

// Load User Files
async function loadUserFiles() {
    const currentSession = await supabaseClient.auth.getSession();
    
    if (!currentSession.data.session) {
        showAlert('Please sign in to view files', 'error');
        return;
    }

    const userId = currentSession.data.session.user.id;
    const userEmail = currentSession.data.session.user.email;
    
    document.getElementById('userEmail').textContent = userEmail;
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('appSection').classList.add('active');

    const filesListDiv = document.getElementById('filesList');
    filesListDiv.innerHTML = '<div class="loading">Loading your files...</div>';

    try {
        const { data: files, error } = await supabaseClient.storage
            .from('files')
            .list(userId);

        if (error) {
            throw error;
        }

        if (!files || files.length === 0) {
            filesListDiv.innerHTML = '<div class="empty-message">📂 No files uploaded yet. Click "Upload" to add files!</div>';
            return;
        }

        // Display files
        let filesHtml = '<ul class="files-list">';
        for (const file of files) {
            const originalName = file.name.split('_').slice(1).join('_');
            const filePath = `${userId}/${file.name}`;
            const { data: urlData } = supabaseClient.storage
                .from('files')
                .getPublicUrl(filePath);

            filesHtml += `
                <li>
                    <a href="${urlData.publicUrl}" target="_blank" title="Click to view/download">
                        📄 ${originalName}
                    </a>
                    <button class="delete-btn" onclick="deleteFile('${filePath}', '${originalName}')">Delete</button>
                </li>
            `;
        }
        filesHtml += '</ul>';
        filesListDiv.innerHTML = filesHtml;

    } catch (error) {
        console.error('Error loading files:', error);
        filesListDiv.innerHTML = '<div class="empty-message">⚠️ Error loading files. Please refresh the page.</div>';
    }
}

// Delete File
async function deleteFile(filePath, fileName) {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
        return;
    }

    try {
        const { error: storageError } = await supabaseClient.storage
            .from('files')
            .remove([filePath]);

        if (storageError) {
            showAlert(`Failed to delete ${fileName}: ${storageError.message}`, 'error');
            return;
        }

        showAlert(`${fileName} deleted successfully!`, 'success');
        loadUserFiles();
    } catch (error) {
        showAlert(`Error deleting ${fileName}`, 'error');
    }
}

// Check if user is already logged in
async function checkAuthState() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        loadUserFiles();
    }
}

// Initialize on page load
checkAuthState();