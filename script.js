
(function () {
    "use strict";

    // ==========================================
    // 1. SETTINGS
    // ==========================================

    const API_URL = "/api/clients";

    const KEYS = [
        "name",
        "company",
        "proposaltitle",
        "proposalstatus",
        "f1",
        "f2",
        "f3"
    ];

    const DB_FIELDS = {
        name: "name",
        company: "company",
        proposaltitle: "proposal_title",
        proposalstatus: "proposal_status",
        f1: "first_follow_up",
        f2: "second_follow_up",
        f3: "third_follow_up"
    };

    let rows = [];
    let editingId = null;
    let busy = false;

    const $ = id => document.getElementById(id);

    const form = $("f");
    const tableBody = $("rows");

    // ==========================================
    // 2. STATUS MESSAGE
    // ==========================================

    function setStatus(message) {
        const el = $("syncStatus");

        if (el) {
            el.textContent = message;
        }
    }

    // ==========================================
    // 3. HTML SAFETY
    // ==========================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    // ==========================================
    // 4. DATABASE FIELD MAPPING
    // ==========================================

    function toDatabase(data) {
        const result = {};

        KEYS.forEach(key => {
            result[DB_FIELDS[key]] = data[key] || null;
        });

        return result;
    }

    function fromDatabase(row) {
        const result = {
            id: row.id
        };

        KEYS.forEach(key => {
            result[key] = row[DB_FIELDS[key]] ?? "";
        });

        return result;
    }

    // ==========================================
    // 5. API REQUEST
    // ==========================================

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });

        const result = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(
                result?.error || `Request failed (${response.status})`
            );
        }

        return result;
    }

    // ==========================================
    // 6. LOAD CLIENTS
    // ==========================================

    async function loadClients() {
        setStatus("Loading clients...");

        try {
            const data = await apiRequest(API_URL);

            rows = Array.isArray(data)
                ? data.map(fromDatabase)
                : [];

            render();

            setStatus("Connected to database");

        } catch (error) {
            console.error("Load error:", error);

            setStatus("Could not load clients: " + error.message);
        }
    }

    // ==========================================
    // 7. ADD CLIENT
    // ==========================================

    async function addClient(data) {
        const saved = await apiRequest(API_URL, {
            method: "POST",
            body: JSON.stringify(toDatabase(data))
        });

        rows.unshift(fromDatabase(saved));
    }

    // ==========================================
    // 8. UPDATE CLIENT
    // ==========================================

    async function updateClient(id, updates) {
        const saved = await apiRequest(API_URL, {
            method: "PUT",
            body: JSON.stringify({
                id,
                ...toDatabase(updates)
            })
        });

        const index = rows.findIndex(row => row.id === id);

        if (index !== -1) {
            rows[index] = fromDatabase(saved);
        }
    }

    // ==========================================
    // 9. DELETE CLIENT
    // ==========================================

    async function deleteClient(id) {
        await apiRequest(
            `${API_URL}?id=${encodeURIComponent(id)}`,
            {
                method: "DELETE"
            }
        );

        rows = rows.filter(row => row.id !== id);
    }

    // ==========================================
    // 10. PROPOSAL STATUS OPTIONS
    // ==========================================

    function getStatusOptions(currentStatus) {
        const field = form.elements.namedItem("proposalstatus");

        if (field && field.tagName === "SELECT") {
            const options = Array.from(field.options);

            if (
                currentStatus &&
                !options.some(option => option.value === currentStatus)
            ) {
                options.push(new Option(currentStatus, currentStatus));
            }

            return options.map(option => ({
                value: option.value,
                label: option.textContent
            }));
        }

        return ["Sent", "Approved", "Rejected", "Pending"]
            .map(value => ({
                value,
                label: value
            }));
    }

    // ==========================================
    // 11. TABLE RENDERING
    // ==========================================

    function statusSelect(row) {
        const options = getStatusOptions(row.proposalstatus);

        return `
            <select
                class="row-status"
                data-id="${escapeHTML(row.id)}"
            >
                ${options.map(option => `
                    <option
                        value="${escapeHTML(option.value)}"
                        ${option.value === row.proposalstatus ? "selected" : ""}
                    >
                        ${escapeHTML(option.label)}
                    </option>
                `).join("")}
            </select>
        `;
    }

    function dateInput(row, key) {
        return `
            <input
                type="date"
                class="row-date"
                data-id="${escapeHTML(row.id)}"
                data-field="${key}"
                value="${escapeHTML(row[key])}"
            >
        `;
    }

    function render() {
        if (!tableBody) return;

        if (rows.length === 0) {
            tableBody.innerHTML = "";

            if ($("empty")) {
                $("empty").style.display = "";
            }

        } else {
            if ($("empty")) {
                $("empty").style.display = "none";
            }

            tableBody.innerHTML = rows.map(row => `
                <tr>
                    <td>${escapeHTML(row.name)}</td>

                    <td>${escapeHTML(row.company)}</td>

                    <td>${escapeHTML(row.proposaltitle)}</td>

                    <td>${statusSelect(row)}</td>

                    <td>${dateInput(row, "f1")}</td>

                    <td>${dateInput(row, "f2")}</td>

                    <td>${dateInput(row, "f3")}</td>

                    <td>
                        <button
                            type="button"
                            data-action="edit"
                            data-id="${escapeHTML(row.id)}"
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            class="del"
                            data-action="delete"
                            data-id="${escapeHTML(row.id)}"
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            `).join("");
        }

        if ($("count")) {
            $("count").textContent = rows.length;
        }
    }

    // ==========================================
    // 12. FORM RESET
    // ==========================================

    function clearForm() {
        form.reset();

        editingId = null;

        const submit = form.querySelector('[type="submit"]');

        if (submit) {
            submit.textContent = "Add Client";
        }
    }

    // ==========================================
    // 13. EDIT CLIENT
    // ==========================================

    function editClient(id) {
        const row = rows.find(item => item.id === id);

        if (!row) return;

        editingId = id;

        KEYS.forEach(key => {
            const field = form.elements.namedItem(key);

            if (field) {
                field.value = row[key] ?? "";
            }
        });

        const submit = form.querySelector('[type="submit"]');

        if (submit) {
            submit.textContent = "Update Client";
        }

        form.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    // ==========================================
    // 14. FORM SUBMISSION
    // ==========================================

    if (form) {
        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            if (busy) return;

            const data = {};

            KEYS.forEach(key => {
                const field = form.elements.namedItem(key);

                data[key] = field
                    ? field.value.trim()
                    : "";
            });

            if (!data.name) {
                alert("Please enter the client name.");
                return;
            }

            if (!data.proposalstatus) {
                alert("Please select a proposal status.");
                return;
            }

            busy = true;

            setStatus("Saving...");

            try {
                if (editingId) {
                    await updateClient(editingId, data);
                } else {
                    await addClient(data);
                }

                clearForm();

                render();

                setStatus("Saved successfully");

            } catch (error) {
                console.error("Save error:", error);

                alert("Could not save client: " + error.message);

                setStatus("Save failed");

            } finally {
                busy = false;
            }
        });

        form.addEventListener("reset", function () {
            editingId = null;

            const submit = form.querySelector('[type="submit"]');

            if (submit) {
                submit.textContent = "Add Client";
            }
        });
    }

    // ==========================================
    // 15. TABLE ACTIONS
    // ==========================================

    if (tableBody) {
        tableBody.addEventListener("click", async function (event) {
            const button = event.target.closest("button[data-action]");

            if (!button || busy) return;

            const id = button.dataset.id;
            const action = button.dataset.action;

            if (action === "edit") {
                editClient(id);
                return;
            }

            if (action === "delete") {
                const confirmed = confirm(
                    "Are you sure you want to delete this client?"
                );

                if (!confirmed) return;

                busy = true;

                setStatus("Deleting...");

                try {
                    await deleteClient(id);

                    render();

                    setStatus("Client deleted");

                } catch (error) {
                    console.error("Delete error:", error);

                    alert("Could not delete client: " + error.message);

                    setStatus("Delete failed");

                } finally {
                    busy = false;
                }
            }
        });

        // ==========================================
        // 16. INLINE STATUS AND DATE UPDATES
        // ==========================================

        tableBody.addEventListener("change", async function (event) {
            const field = event.target;

            if (
                !field.matches(".row-status, .row-date") ||
                busy
            ) {
                return;
            }

            const id = field.dataset.id;

            const key = field.matches(".row-status")
                ? "proposalstatus"
                : field.dataset.field;

            const currentRow = rows.find(row => row.id === id);

            if (!currentRow) return;

            const updates = {
                ...currentRow,
                [key]: field.value
            };

            busy = true;

            setStatus("Updating...");

            try {
                await updateClient(id, updates);

                render();

                setStatus("Changes saved");

            } catch (error) {
                console.error("Update error:", error);

                alert("Could not update client: " + error.message);

                render();

                setStatus("Update failed");

            } finally {
                busy = false;
            }
        });
    }

    // ==========================================
    // 17. START WEBSITE
    // ==========================================

    loadClients();

})();
