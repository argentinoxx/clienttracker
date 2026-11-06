
(function () {

    // ==========================================
    // 1. SETTINGS
    // ==========================================

    const API_URL = "/api/clients";

    const DB_FIELDS = {
        name: "name",
        company: "company",
        proposaltitle: "proposal_title",
        proposalstatus: "proposal_status",
        f1: "first_follow_up",
        f2: "second_follow_up",
        f3: "third_follow_up"
    };

    const FIELD_KEYS = Object.keys(DB_FIELDS);

    let clients = [];
    let editingId = null;
    let busy = false;

    const $ = (id) => document.getElementById(id);

    const form = $("f");
    const rowsContainer = $("rows");
    const emptyMessage = $("empty");
    const count = $("count");
    const syncStatus = $("syncStatus");


    // ==========================================
    // 2. STATUS MESSAGE
    // ==========================================

    function setStatus(message, isError = false) {
        syncStatus.textContent = message;
        syncStatus.style.color = isError ? "#dc2626" : "#666";
    }


    // ==========================================
    // 3. SAFE HTML OUTPUT
    // ==========================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char];
        });
    }


    // ==========================================
    // 4. DATABASE FIELD CONVERSION
    // ==========================================

    function toDatabase(data) {
        const result = {};

        FIELD_KEYS.forEach(key => {
            result[DB_FIELDS[key]] = data[key] || null;
        });

        return result;
    }

    function fromDatabase(client) {
        const result = { id: client.id };

        FIELD_KEYS.forEach(key => {
            result[key] = client[DB_FIELDS[key]] || "";
        });

        return result;
    }


    // ==========================================
    // 5. API REQUEST
    // ==========================================

    async function apiRequest(method, body = null, id = null) {

        const options = {
            method: method,
            headers: {
                "Content-Type": "application/json"
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        let url = API_URL;

        if (id) {
            url += "?id=" + encodeURIComponent(id);
        }

        const response = await fetch(url, options);

        let result = null;

        try {
            result = await response.json();
        } catch (error) {
            result = null;
        }

        if (!response.ok) {
            throw new Error(
                result?.error || "Something went wrong with the database."
            );
        }

        return result;
    }


    // ==========================================
    // 6. LOAD CLIENTS
    // ==========================================

    async function loadClients() {

        setStatus("Loading client records...");

        try {
            const data = await apiRequest("GET");

            clients = data.map(fromDatabase);

            editingId = null;

            render();

            setStatus("Connected to database.");

        } catch (error) {
            console.error(error);
            setStatus("Unable to load client records.", true);
        }
    }


    // ==========================================
    // 7. ADD CLIENT
    // ==========================================

    async function addClient(data) {

        if (busy) return;

        busy = true;
        setStatus("Adding client...");

        try {
            await apiRequest("POST", toDatabase(data));

            form.reset();

            await loadClients();

            setStatus("Client added successfully.");

        } catch (error) {
            console.error(error);
            setStatus("Unable to add client: " + error.message, true);

        } finally {
            busy = false;
            render();
        }
    }


    // ==========================================
    // 8. UPDATE CLIENT
    // ==========================================

    async function updateClient(id, data) {

        if (busy) return;

        busy = true;
        setStatus("Saving changes...");

        try {
            await apiRequest("PUT", {
                id: id,
                ...toDatabase(data)
            });

            editingId = null;

            await loadClients();

            setStatus("Client updated successfully.");

        } catch (error) {
            console.error(error);
            setStatus("Unable to update client: " + error.message, true);

        } finally {
            busy = false;
            render();
        }
    }


    // ==========================================
    // 9. DELETE CLIENT
    // ==========================================

    async function deleteClient(id) {

        if (busy) return;

        const confirmed = confirm(
            "Are you sure you want to delete this client?"
        );

        if (!confirmed) return;

        busy = true;
        setStatus("Deleting client...");

        try {
            await apiRequest("DELETE", null, id);

            if (editingId === id) {
                editingId = null;
            }

            await loadClients();

            setStatus("Client deleted successfully.");

        } catch (error) {
            console.error(error);
            setStatus("Unable to delete client: " + error.message, true);

        } finally {
            busy = false;
            render();
        }
    }


    // ==========================================
    // 10. INPUT FIELD HELPERS
    // ==========================================

    function getStatusOptions(currentStatus) {

        const statuses = ["Sent", "Approved", "Rejected", "Pending"];

        return statuses.map(status => `
            <option value="${status}"
                ${currentStatus === status ? "selected" : ""}>
                ${status}
            </option>
        `).join("");
    }


    function renderField(row, key, isEditing) {

        const value = row[key] || "";

        if (!isEditing) {
            return escapeHTML(value);
        }

        if (key === "proposalstatus") {
            return `
                <select name="${key}">
                    <option value="">Select Status</option>
                    ${getStatusOptions(value)}
                </select>
            `;
        }

        if (["f1", "f2", "f3"].includes(key)) {
            return `
                <input
                    type="date"
                    name="${key}"
                    value="${escapeHTML(value)}"
                >
            `;
        }

        return `
            <input
                type="text"
                name="${key}"
                value="${escapeHTML(value)}"
                ${key === "name" ? "required" : ""}
            >
        `;
    }


    // ==========================================
    // 11. RENDER TABLE
    // ==========================================

    function render() {

        count.textContent = clients.length;

        emptyMessage.style.display =
            clients.length === 0 ? "block" : "none";

        rowsContainer.innerHTML = clients.map(row => {

            const isEditing = editingId === row.id;
            const anotherIsEditing =
                editingId !== null && !isEditing;

            return `
                <tr data-id="${escapeHTML(row.id)}">

                    <td>${renderField(row, "name", isEditing)}</td>

                    <td>${renderField(row, "company", isEditing)}</td>

                    <td>${renderField(row, "proposaltitle", isEditing)}</td>

                    <td>${renderField(row, "proposalstatus", isEditing)}</td>

                    <td>${renderField(row, "f1", isEditing)}</td>

                    <td>${renderField(row, "f2", isEditing)}</td>

                    <td>${renderField(row, "f3", isEditing)}</td>

                    <td>
                        <div class="actions">

                            ${
                                isEditing
                                ? `
                                    <button
                                        type="button"
                                        class="save-btn"
                                        data-action="save"
                                        ${busy ? "disabled" : ""}
                                    >
                                        Save
                                    </button>

                                    <button
                                        type="button"
                                        class="cancel-btn"
                                        data-action="cancel"
                                        ${busy ? "disabled" : ""}
                                    >
                                        Cancel
                                    </button>
                                `
                                : `
                                    <button
                                        type="button"
                                        class="edit-btn"
                                        data-action="edit"
                                        ${anotherIsEditing || busy ? "disabled" : ""}
                                    >
                                        Edit
                                    </button>

                                    <button
                                        type="button"
                                        class="delete-btn"
                                        data-action="delete"
                                        ${editingId !== null || busy ? "disabled" : ""}
                                    >
                                        Delete
                                    </button>
                                `
                            }

                        </div>
                    </td>

                </tr>
            `;

        }).join("");
    }


    // ==========================================
    // 12. GET ROW VALUES
    // ==========================================

    function getRowData(rowElement) {

        const data = {};

        FIELD_KEYS.forEach(key => {

            const field = rowElement.querySelector(`[name="${key}"]`);

            data[key] = field ? field.value.trim() : "";

        });

        return data;
    }


    // ==========================================
    // 13. ADD CLIENT FORM
    // ==========================================

    form.addEventListener("submit", async function (event) {

        event.preventDefault();

        if (busy || editingId !== null) return;

        const formData = new FormData(form);
        const data = {};

        FIELD_KEYS.forEach(key => {
            data[key] = String(formData.get(key) || "").trim();
        });

        if (!data.name) {
            alert("Please enter the client name.");
            return;
        }

        if (!data.proposalstatus) {
            alert("Please select a proposal status.");
            return;
        }

        await addClient(data);

    });


    // ==========================================
    // 14. TABLE BUTTON ACTIONS
    // ==========================================

    rowsContainer.addEventListener("click", async function (event) {

        const button = event.target.closest("button[data-action]");

        if (!button || busy) return;

        const rowElement = button.closest("tr");

        if (!rowElement) return;

        const id = rowElement.dataset.id;
        const action = button.dataset.action;

        const client = clients.find(item => item.id === id);

        if (!client) return;


        // EDIT
        if (action === "edit") {

            if (editingId !== null) return;

            editingId = id;

            render();

            return;
        }


        // CANCEL
        if (action === "cancel") {

            if (editingId !== id) return;

            editingId = null;

            render();

            return;
        }


        // SAVE
        if (action === "save") {

            if (editingId !== id) return;

            const data = getRowData(rowElement);

            if (!data.name) {
                alert("Client name is required.");
                return;
            }

            if (!data.proposalstatus) {
                alert("Please select a proposal status.");
                return;
            }

            await updateClient(id, data);

            return;
        }


        // DELETE
        if (action === "delete") {

            if (editingId !== null) return;

            await deleteClient(id);

        }

    });


    // ==========================================
    // 15. INITIAL LOAD
    // ==========================================

    loadClients();

})();
