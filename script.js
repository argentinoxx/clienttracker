
(function () {

    // ==========================================
    // 1. INITIAL SETTINGS
    // ==========================================

    var KEYS = ["name", "company", "proposal", "f1", "f2", "f3"];

    var rows = [];
    var LKEY = "client-tracker-rows";

    var $ = function (id) {
        return document.getElementById(id);
    };

    var XLSXMIME =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    var fh = null;
    var selectedFile = null;
    var supported = ("showOpenFilePicker" in window);
    var connected = false;


    // ==========================================
    // 2. BROWSER STORAGE
    // ==========================================

    function lsLoad() {
        try {
            return JSON.parse(localStorage.getItem(LKEY) || "[]");
        } catch (e) {
            return [];
        }
    }

    function lsSave() {
        try {
            localStorage.setItem(LKEY, JSON.stringify(rows));
        } catch (e) {
            console.error("Unable to save browser data:", e);
        }
    }


    // ==========================================
    // 3. DISPLAY CLIENT RECORDS
    // ==========================================

    function render() {

        var tb = $("rows");
        tb.textContent = "";

        rows.forEach(function (r) {

            var tr = document.createElement("tr");

            KEYS.forEach(function (k) {

                var td = document.createElement("td");

                if (k === "f1" || k === "f2" || k === "f3") {

                    var i = document.createElement("input");

                    i.type = "date";
                    i.value = r[k] || "";

                    i.addEventListener("change", function () {
                        update(r, k, i.value);
                    });

                    td.appendChild(i);

                } else {

                    td.textContent = r[k] || "";

                }

                tr.appendChild(td);

            });

            var td = document.createElement("td");

            var b = document.createElement("button");

            b.className = "del";
            b.type = "button";
            b.textContent = "Delete";

            b.addEventListener("click", function () {

                if (confirm("Delete this client?")) {
                    remove(r);
                }

            });

            td.appendChild(b);
            tr.appendChild(td);
            tb.appendChild(tr);

        });

        $("count").textContent = rows.length;

        $("empty").style.display = rows.length ? "none" : "block";

    }


    // ==========================================
    // 4. ADD CLIENT
    // ==========================================

    function add(data) {

        data.createdAt = Date.now();
        data.id = "l" + data.createdAt;

        rows.push(data);

        lsSave();
        render();
        sync();

    }


    // ==========================================
    // 5. UPDATE CLIENT
    // ==========================================

    function update(r, k, v) {

        r[k] = v;

        lsSave();
        sync();

    }


    // ==========================================
    // 6. DELETE CLIENT
    // ==========================================

    function remove(r) {

        rows = rows.filter(function (x) {
            return x !== r;
        });

        lsSave();
        render();
        sync();

    }


    // ==========================================
    // 7. FORM SUBMISSION
    // ==========================================

    $("f").addEventListener("submit", function (e) {

        e.preventDefault();

        var fd = new FormData(e.target);
        var d = {};

        KEYS.forEach(function (k) {
            d[k] = (fd.get(k) || "").trim();
        });

        // Save new client
        add(d);

        // Clear form
        e.target.reset();

        // Return cursor to Client Name
        e.target.elements.name.focus();

    });


    // ==========================================
    // 8. EXCEL STATUS
    // ==========================================

    function setStatus(t) {
        $("syncStatus").textContent = t;
    }


    // ==========================================
    // 9. FORMAT EXCEL DATES
    // ==========================================

    function formatDate(value) {

        if (!value) return "";

        if (value instanceof Date) {
            return value.toISOString().slice(0, 10);
        }

        if (typeof value === "number") {

            var d = XLSX.SSF.parse_date_code(value);

            if (d) {
                return d.y + "-" +
                    String(d.m).padStart(2, "0") + "-" +
                    String(d.d).padStart(2, "0");
            }

        }

        var parsed = new Date(value);

        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().slice(0, 10);
        }

        return "";

    }


    // ==========================================
    // 10. IMPORT EXCEL RECORDS
    // ==========================================

    function importExcel(arrayBuffer) {

        try {

            var workbook = XLSX.read(arrayBuffer, {
                type: "array",
                cellDates: true
            });

            var sheet = workbook.Sheets[workbook.SheetNames[0]];

            var data = XLSX.utils.sheet_to_json(sheet, {
                defval: ""
            });

            var imported = data.map(function (r, index) {

                return {

                    id: "excel-" + Date.now() + "-" + index,

                    name: r["Client Name"] || r["name"] || "",

                    company: r["Company"] || r["company"] || "",

                    proposal: r["Proposal"] || r["proposal"] || "",

                    f1: formatDate(r["First Follow Up"] || r["f1"]),

                    f2: formatDate(r["2nd Follow Up"] || r["f2"]),

                    f3: formatDate(r["3rd Follow Up"] || r["f3"])

                };

            }).filter(function (r) {
                return r.name || r.company;
            });

            rows = imported;

            lsSave();
            render();

            setStatus("Excel file loaded: " + rows.length + " clients.");

            return true;

        } catch (error) {

            setStatus("Unable to read Excel file.");

            console.error(error);

            return false;

        }

    }


    // ==========================================
    // 11. SELECT EXCEL FILE
    // ==========================================

    async function selectExcelFile() {

        try {

            if (supported) {

                var handles = await window.showOpenFilePicker({

                    multiple: false,

                    types: [{
                        description: "Excel Workbook",
                        accept: {
                            [XLSXMIME]: [".xlsx"]
                        }
                    }]

                });

                fh = handles[0];

                selectedFile = await fh.getFile();

                var buffer = await selectedFile.arrayBuffer();

                if (importExcel(buffer)) {

                    $("link").disabled = false;

                    $("chg").style.display = "inline-block";

                    setStatus("Selected: " + selectedFile.name);

                } else {

                    fh = null;

                }

            } else {

                $("excelFallback").click();

            }

        } catch (error) {

            if (error.name !== "AbortError") {

                setStatus("Could not select Excel file.");

                console.error(error);

            }

        }

    }


    // ==========================================
    // 12. FALLBACK FILE SELECTION
    // ==========================================

    $("excelFallback").addEventListener("change", async function (e) {

        var file = e.target.files[0];

        if (!file) return;

        selectedFile = file;
        fh = null;
        connected = false;

        var buffer = await file.arrayBuffer();

        if (importExcel(buffer)) {

            $("link").disabled = false;

            $("chg").style.display = "inline-block";

            setStatus(
                "Imported: " + file.name +
                ". Direct automatic saving is unavailable in this browser."
            );

        }

        e.target.value = "";

    });


    // ==========================================
    // 13. BUILD EXCEL WORKBOOK
    // ==========================================

    function buildXlsx() {

        var aoa = [[
            "Client Name",
            "Company",
            "Proposal",
            "First Follow Up",
            "2nd Follow Up",
            "3rd Follow Up"
        ]];

        rows.forEach(function (r) {

            aoa.push([

                r.name,
                r.company,
                r.proposal,

                r.f1 ? new Date(r.f1 + "T00:00:00Z") : "",

                r.f2 ? new Date(r.f2 + "T00:00:00Z") : "",

                r.f3 ? new Date(r.f3 + "T00:00:00Z") : ""

            ]);

        });

        var ws = XLSX.utils.aoa_to_sheet(aoa, {
            cellDates: true
        });

        ws["!cols"] = [
            { wch: 24 },
            { wch: 28 },
            { wch: 34 },
            { wch: 18 },
            { wch: 18 },
            { wch: 18 }
        ];

        for (var R = 1; R < aoa.length; R++) {

            for (var C = 3; C < 6; C++) {

                var cell = ws[XLSX.utils.encode_cell({
                    r: R,
                    c: C
                })];

                if (cell && cell.t === "d") {
                    cell.z = "mmm d, yyyy";
                }

            }

        }

        var wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            wb,
            ws,
            "Client Tracker"
        );

        return XLSX.write(wb, {
            bookType: "xlsx",
            type: "array"
        });

    }


    // ==========================================
    // 14. CONNECT EXCEL FILE
    // ==========================================

    async function connectExcel() {

        if (!selectedFile) {

            setStatus("Please select an Excel file first.");

            return;

        }

        if (!fh) {

            setStatus(
                "File imported, but direct saving requires a supported browser. " +
                "Use Download Excel Backup to save changes."
            );

            return;

        }

        try {

            var permission = await fh.queryPermission({
                mode: "readwrite"
            });

            if (permission !== "granted") {

                permission = await fh.requestPermission({
                    mode: "readwrite"
                });

            }

            if (permission !== "granted") {

                setStatus("Permission to edit Excel file was denied.");

                return;

            }

            connected = true;

            $("link").textContent = "Excel Connected";
            $("link").disabled = true;

            setStatus("Connected to " + selectedFile.name);

            await sync();

        } catch (error) {

            setStatus("Unable to connect to Excel file.");

            console.error(error);

        }

    }


    // ==========================================
    // 15. AUTOMATIC EXCEL SYNCHRONIZATION
    // ==========================================

    async function sync() {

        lsSave();

        if (!connected || !fh) return;

        try {

            var data = buildXlsx();

            var writable = await fh.createWritable();

            await writable.write(data);

            await writable.close();

            setStatus("Excel synchronized successfully.");

        } catch (error) {

            setStatus("Excel synchronization failed. Please reconnect.");

            console.error(error);

        }

    }


    // ==========================================
    // 16. DOWNLOAD EXCEL BACKUP
    // ==========================================

    function downloadExcel() {

        var data = buildXlsx();

        var blob = new Blob([data], {
            type: XLSXMIME
        });

        var url = URL.createObjectURL(blob);

        var a = document.createElement("a");

        a.href = url;

        a.download = "Client_Follow_Up_Tracker.xlsx";

        a.click();

        URL.revokeObjectURL(url);

    }


    // ==========================================
    // 17. BUTTON EVENTS
    // ==========================================

    $("selectExcel").addEventListener("click", selectExcelFile);

    $("link").addEventListener("click", connectExcel);

    $("chg").addEventListener("click", async function () {

        connected = false;
        fh = null;
        selectedFile = null;

        $("link").textContent = "Connect Excel File";
        $("link").disabled = true;

        await selectExcelFile();

    });

    $("downloadExcel").addEventListener("click", downloadExcel);


    // ==========================================
    // 18. INITIALIZE TRACKER
    // ==========================================

    $("link").disabled = true;

    rows = lsLoad();

    render();

    if (!supported) {

        setStatus(
            "Select a file to import. Direct Excel synchronization " +
            "requires a supported browser."
        );

    }

})();
