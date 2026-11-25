const API_URL = "/api";
let isRegisterMode = false;
let currentUser = null;
let categories = [];
let toastTimer = null;
let filterTimer = null;

const $ = (id) => document.getElementById(id);

const authScreen = $("authScreen");
const appContainer = document.querySelector(".app-container");
const loginTab = $("loginTab");
const registerTab = $("registerTab");
const nameGroup = $("nameGroup");
const authName = $("authName");
const authEmail = $("authEmail");
const authPassword = $("authPassword");
const authSubmitBtn = $("authSubmitBtn");
const authError = $("authError");

// ---------------- HELPERS ----------------

// Build DOM nodes safely (text goes through textContent, never innerHTML)
function h(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
        if (value === null || value === undefined || value === false) return;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key.startsWith("on") && typeof value === "function") {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else node.setAttribute(key, value === true ? "" : value);
    });
    [].concat(children).forEach((child) => {
        if (child === null || child === undefined || child === false) return;
        node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
}

function toast(message, isError = false) {
    const el = $("toast");
    el.textContent = message;
    el.classList.toggle("error", isError);
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 3200);
}

function getToken() {
    return localStorage.getItem("token");
}

async function api(path, { method = "GET", body } = {}) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    let data = {};
    try {
        data = await res.json();
    } catch (err) {
        data = {};
    }

    if (res.status === 401 && token && !path.startsWith("/auth")) {
        logout();
        throw new Error("Your session expired. Please log in again.");
    }
    if (!res.ok) throw new Error(data.message || "Something went wrong.");
    return data;
}

function formatDate(value) {
    return new Date(value).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
    });
}

function formatTime(time) {
    if (!time) return "";
    const [hh, mm] = time.split(":").map(Number);
    if (Number.isNaN(hh)) return time;
    const suffix = hh >= 12 ? "PM" : "AM";
    return `${hh % 12 || 12}:${String(mm || 0).padStart(2, "0")} ${suffix}`;
}

function formatPrice(price) {
    return price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Free";
}

function initialsOf(name) {
    return (name || "U")
        .split(" ")
        .filter(Boolean)
        .map((word) => word[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function fillClass(count, capacity) {
    const ratio = capacity ? count / capacity : 0;
    if (ratio >= 1) return "full";
    if (ratio >= 0.8) return "warn";
    return "";
}

// ---------------- AUTH ----------------

function setAuthMode(registerMode) {
    isRegisterMode = registerMode;
    loginTab.classList.toggle("active", !registerMode);
    registerTab.classList.toggle("active", registerMode);
    nameGroup.classList.toggle("hidden", !registerMode);
    authName.required = registerMode;
    authSubmitBtn.textContent = registerMode ? "Create Account →" : "Login to Dashboard →";
    authError.classList.add("hidden");
}

loginTab.addEventListener("click", () => setAuthMode(false));
registerTab.addEventListener("click", () => setAuthMode(true));

function applyUser(user) {
    currentUser = user;
    const initials = initialsOf(user.name);
    $("sidebarName").textContent = user.name || "Your Name";
    $("sidebarOrg").textContent = user.organization || "Event member";
    document.querySelectorAll(".avatar").forEach((el) => (el.textContent = initials));

    $("profileName").value = user.name || "";
    $("profileEmail").value = user.email || "";
    $("profilePhone").value = user.phone || "";
    $("profileOrg").value = user.organization || "";
    $("profileBio").value = user.bio || "";
}

function showApp() {
    authScreen.classList.add("hidden");
    appContainer.classList.remove("hidden");
    showPage("dashboard");
}

function logout() {
    localStorage.removeItem("token");
    currentUser = null;
    appContainer.classList.add("hidden");
    authScreen.classList.remove("hidden");
    closeModals();
    setAuthMode(false);
}

$("authForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    authError.classList.add("hidden");

    const endpoint = isRegisterMode ? "/auth/register" : "/auth/login";
    const payload = isRegisterMode
        ? { name: authName.value.trim(), email: authEmail.value.trim(), password: authPassword.value }
        : { email: authEmail.value.trim(), password: authPassword.value };

    authSubmitBtn.disabled = true;
    try {
        const data = await api(endpoint, { method: "POST", body: payload });
        localStorage.setItem("token", data.token);
        applyUser(data.user);
        await loadCategories();
        showApp();
        this.reset();
    } catch (err) {
        const offline = err instanceof TypeError;
        authError.textContent = offline
            ? "Cannot connect to server. Start Express with 'npm start' inside backend/."
            : err.message;
        authError.classList.remove("hidden");
    } finally {
        authSubmitBtn.disabled = false;
    }
});

$("logoutBtn").addEventListener("click", logout);

async function checkAuthSession() {
    if (!getToken()) {
        appContainer.classList.add("hidden");
        authScreen.classList.remove("hidden");
        return;
    }

    try {
        const user = await api("/user/profile");
        applyUser({ ...user, id: user._id });
        await loadCategories();
        showApp();
    } catch (err) {
        localStorage.removeItem("token");
        appContainer.classList.add("hidden");
        authScreen.classList.remove("hidden");
    }
}

// ---------------- NAVIGATION ----------------

const navLinks = document.querySelectorAll(".nav-link");
const pages = document.querySelectorAll(".page-section");

const pageTitles = {
    dashboard: "Dashboard",
    discover: "Discover Events",
    registrations: "My Registrations",
    myevents: "My Events",
    profile: "My Profile"
};

const pageLoaders = {
    dashboard: loadDashboard,
    discover: loadDiscover,
    registrations: loadRegistrations,
    myevents: loadMyEvents,
    profile: () => {}
};

function showPage(pageId) {
    pages.forEach((page) => page.classList.toggle("hidden", page.id !== pageId));
    navLinks.forEach((link) => link.classList.toggle("active", link.dataset.page === pageId));

    const title = pageTitles[pageId] || "Dashboard";
    $("breadcrumbText").textContent = `Pages / ${title}`;
    $("topbarTitle").textContent = title;
    window.scrollTo({ top: 0, behavior: "smooth" });

    const loader = pageLoaders[pageId];
    if (loader) loader().catch((err) => toast(err.message, true));
}

navLinks.forEach((link) => {
    link.addEventListener("click", function (event) {
        event.preventDefault();
        showPage(this.dataset.page);
    });
});

document.querySelectorAll("[data-goto]").forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.goto));
});

$("browseBtn").addEventListener("click", () => showPage("discover"));
$("createBtn").addEventListener("click", () => openEventModal());
$("helpBtn").addEventListener("click", () => openEventModal());
$("newEventBtn").addEventListener("click", () => openEventModal());

// ---------------- CATEGORIES ----------------

async function loadCategories() {
    if (categories.length) return;
    try {
        categories = await api("/events/categories");
    } catch (err) {
        categories = ["Conference", "Workshop", "Concert", "Sports", "Networking", "Festival", "Webinar", "Other"];
    }

    const filter = $("filterCategory");
    filter.replaceChildren(h("option", { value: "All", text: "All categories" }));
    categories.forEach((c) => filter.appendChild(h("option", { value: c, text: c })));

    $("eventCategory").replaceChildren(...categories.map((c) => h("option", { value: c, text: c })));
}

// ---------------- EVENT CARDS ----------------

function renderEmpty(container, message) {
    container.replaceChildren(h("p", { class: "empty-note", text: message }));
}

function buildEventCard(event, { onChange }) {
    const left = event.spotsLeft;
    const actions = [];

    if (event.isOrganizer) {
        actions.push(
            h("button", { class: "ghost-btn", type: "button", text: `Attendees (${event.attendeeCount})`, onClick: () => openAttendeeModal(event) }),
            h("button", { class: "ghost-btn", type: "button", text: "Edit", onClick: () => openEventModal(event) }),
            h("button", { class: "danger-btn", type: "button", text: "Delete", onClick: () => deleteEvent(event, onChange) })
        );
    } else if (event.isPast) {
        actions.push(h("span", { class: "status-note", text: event.isRegistered ? "You attended / were registered" : "This event has ended" }));
    } else if (event.isRegistered) {
        actions.push(
            h("span", { class: "badge", text: "✓ Registered" }),
            h("button", { class: "danger-btn", type: "button", text: "Cancel", onClick: () => cancelRegistration(event, onChange) })
        );
    } else if (event.isFull) {
        actions.push(h("span", { class: "status-note", text: "Sold out — event is full" }));
    } else {
        actions.push(
            h("button", { class: "primary-btn", type: "button", text: event.price > 0 ? `Register · ${formatPrice(event.price)}` : "Register — Free", onClick: () => registerForEvent(event, onChange) })
        );
    }

    return h("article", { class: `event-card${event.isPast ? " past" : ""}` }, [
        h("div", { class: "event-top" }, [
            h("span", { class: "badge", text: event.category }),
            event.isOrganizer
                ? h("span", { class: "badge mine", text: "Hosting" })
                : h("span", { class: `badge${event.price > 0 ? "" : " free"}`, text: formatPrice(event.price) })
        ]),
        h("h3", { text: event.title }),
        event.description ? h("p", { class: "event-desc", text: event.description }) : null,
        h("div", { class: "event-meta" }, [
            h("span", { text: `📅 ${formatDate(event.date)} · ${formatTime(event.time)}` }),
            h("span", { text: `📍 ${event.venue}` }),
            h("span", { text: `👤 Hosted by ${event.organizerName || "Organizer"}` })
        ]),
        h("div", { class: "spots" }, [
            h("div", { class: "bar-info" }, [
                h("span", { text: event.isFull ? "Full" : `${left} spot${left === 1 ? "" : "s"} left` }),
                h("span", { text: `${event.attendeeCount}/${event.capacity}` })
            ]),
            h("div", { class: "progress-track" }, [
                h("div", {
                    class: `progress-fill ${fillClass(event.attendeeCount, event.capacity)}`,
                    style: `width:${Math.min(Math.round((event.attendeeCount / event.capacity) * 100), 100)}%`
                })
            ])
        ]),
        h("div", { class: "event-actions" }, actions)
    ]);
}

function renderEvents(container, events, emptyMessage, opts) {
    if (!events.length) return renderEmpty(container, emptyMessage);
    container.replaceChildren(...events.map((e) => buildEventCard(e, opts)));
}

// ---------------- EVENT ACTIONS ----------------

async function registerForEvent(event, onChange) {
    try {
        await api(`/events/${event._id}/register`, { method: "POST" });
        toast(`You're registered for "${event.title}"!`);
        await onChange();
    } catch (err) {
        toast(err.message, true);
        await onChange().catch(() => {});
    }
}

async function cancelRegistration(event, onChange) {
    if (!confirm(`Cancel your registration for "${event.title}"?`)) return;
    try {
        await api(`/events/${event._id}/register`, { method: "DELETE" });
        toast("Registration cancelled.");
        await onChange();
    } catch (err) {
        toast(err.message, true);
    }
}

async function deleteEvent(event, onChange) {
    const note = event.attendeeCount
        ? `\n\n${event.attendeeCount} registered attendee(s) will lose their spot.`
        : "";
    if (!confirm(`Delete "${event.title}"? This cannot be undone.${note}`)) return;
    try {
        await api(`/events/${event._id}`, { method: "DELETE" });
        toast("Event deleted.");
        await onChange();
    } catch (err) {
        toast(err.message, true);
    }
}

// ---------------- PAGE LOADERS ----------------

async function loadDashboard() {
    const [stats, upcoming] = await Promise.all([
        api("/events/stats"),
        api("/events?scope=upcoming")
    ]);

    $("statUpcoming").textContent = String(stats.upcomingTotal).padStart(2, "0");
    $("statRegistrations").textContent = String(stats.registrations).padStart(2, "0");
    $("statCreated").textContent = String(stats.eventsCreated).padStart(2, "0");
    $("statAttendees").textContent = String(stats.totalAttendees).padStart(2, "0");

    // Fill rate circle
    $("fillCircleText").textContent = `${stats.fillRate}%`;
    $("fillCircle").style.background =
        `conic-gradient(#2dd4bf 0% ${stats.fillRate}%, #1b2f2e ${stats.fillRate}% 100%)`;

    // Top events bars
    const bars = $("topEventBars");
    if (!stats.topEvents.length) {
        renderEmpty(bars, "You haven't hosted any events yet. Create one to see registrations fill up here.");
    } else {
        bars.replaceChildren(
            ...stats.topEvents.map((e) =>
                h("div", { class: "bar-item" }, [
                    h("div", { class: "bar-info" }, [
                        h("span", { text: e.title }),
                        h("span", { text: `${e.attendeeCount}/${e.capacity}` })
                    ]),
                    h("div", { class: "progress-track" }, [
                        h("div", {
                            class: `progress-fill ${fillClass(e.attendeeCount, e.capacity)}`,
                            style: `width:${Math.min(Math.round((e.attendeeCount / e.capacity) * 100), 100)}%`
                        })
                    ])
                ])
            )
        );
    }

    // Next registered event
    const box = $("nextEventBox");
    if (stats.nextEvent) {
        box.replaceChildren(
            h("span", { text: "Your next event" }),
            h("strong", { text: stats.nextEvent.title }),
            h("span", { text: `${formatDate(stats.nextEvent.date)} · ${formatTime(stats.nextEvent.time)}` }),
            h("br"),
            h("span", { text: stats.nextEvent.venue })
        );
    } else {
        box.replaceChildren(h("span", { text: "You have no upcoming registrations yet. Find something to join in Discover Events." }));
    }

    renderEvents($("dashboardEvents"), upcoming.slice(0, 3), "No upcoming events yet — be the first to create one!", { onChange: loadDashboard });
}

async function loadDiscover() {
    const params = new URLSearchParams();
    const search = $("filterSearch").value.trim();
    if (search) params.set("search", search);
    params.set("category", $("filterCategory").value);
    params.set("scope", $("filterScope").value);

    const events = await api(`/events?${params.toString()}`);
    renderEvents($("discoverEvents"), events, "No events match your filters.", { onChange: loadDiscover });
}

async function loadRegistrations() {
    const events = await api("/events/my/registrations");
    renderEvents($("registrationEvents"), events, "You haven't registered for any events yet.", { onChange: loadRegistrations });
}

async function loadMyEvents() {
    const events = await api("/events/my/created");
    renderEvents($("myEventList"), events, "You haven't created any events yet. Click “+ New Event” to start.", { onChange: loadMyEvents });
}

// Filters
$("filterForm").addEventListener("submit", (e) => e.preventDefault());
$("filterSearch").addEventListener("input", () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => loadDiscover().catch((err) => toast(err.message, true)), 300);
});
["filterCategory", "filterScope"].forEach((id) =>
    $(id).addEventListener("change", () => loadDiscover().catch((err) => toast(err.message, true)))
);

// ---------------- EVENT MODAL (CREATE / EDIT) ----------------

function closeModals() {
    document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden"));
}

document.querySelectorAll("[data-close-modal]").forEach((btn) => btn.addEventListener("click", closeModals));
document.querySelectorAll(".modal").forEach((modal) =>
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModals();
    })
);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModals();
});

function openEventModal(event = null) {
    const form = $("eventForm");
    form.reset();
    $("eventFormError").classList.add("hidden");

    const today = new Date().toISOString().slice(0, 10);
    $("eventDate").min = event ? "" : today;

    if (event) {
        $("eventModalTitle").textContent = "Edit Event";
        $("eventSubmitBtn").textContent = "Save Changes";
        $("eventId").value = event._id;
        $("eventTitle").value = event.title;
        $("eventDescription").value = event.description || "";
        $("eventCategory").value = event.category;
        $("eventVenue").value = event.venue;
        $("eventDate").value = new Date(event.date).toISOString().slice(0, 10);
        $("eventTime").value = event.time || "10:00";
        $("eventCapacity").value = event.capacity;
        $("eventCapacity").min = Math.max(event.attendeeCount, 1);
        $("eventPrice").value = event.price;
    } else {
        $("eventModalTitle").textContent = "Create Event";
        $("eventSubmitBtn").textContent = "Create Event";
        $("eventId").value = "";
        $("eventCapacity").min = 1;
        $("eventCapacity").value = 50;
        $("eventPrice").value = 0;
        $("eventTime").value = "10:00";
    }

    $("eventModal").classList.remove("hidden");
    $("eventTitle").focus();
}

$("eventForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const errorEl = $("eventFormError");
    errorEl.classList.add("hidden");

    const id = $("eventId").value;
    const body = {
        title: $("eventTitle").value.trim(),
        description: $("eventDescription").value.trim(),
        category: $("eventCategory").value,
        venue: $("eventVenue").value.trim(),
        date: $("eventDate").value,
        time: $("eventTime").value,
        capacity: Number($("eventCapacity").value),
        price: Number($("eventPrice").value || 0)
    };

    const btn = $("eventSubmitBtn");
    btn.disabled = true;
    try {
        await api(id ? `/events/${id}` : "/events", { method: id ? "PUT" : "POST", body });
        closeModals();
        toast(id ? "Event updated." : "Event created!");
        const active = [...pages].find((p) => !p.classList.contains("hidden"));
        if (active && pageLoaders[active.id]) await pageLoaders[active.id]();
        if (!id && active && active.id !== "myevents") showPage("myevents");
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
    } finally {
        btn.disabled = false;
    }
});

// ---------------- ATTENDEES MODAL ----------------

function openAttendeeModal(event) {
    $("attendeeModalTitle").textContent = `Attendees — ${event.title}`;
    const list = $("attendeeList");
    const attendees = event.attendees || [];

    if (!attendees.length) {
        renderEmpty(list, "Nobody has registered yet.");
    } else {
        list.replaceChildren(
            ...attendees.map((a, i) =>
                h("div", { class: "attendee-row" }, [
                    h("div", {}, [
                        h("span", { text: `${i + 1}. ${a.name}` }),
                        h("small", { text: a.email })
                    ]),
                    h("span", { class: "when", text: new Date(a.registeredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) })
                ])
            )
        );
    }
    $("attendeeModal").classList.remove("hidden");
}

// ---------------- PROFILE ----------------

$("profileForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = $("profileName").value.trim();
    const email = $("profileEmail").value.trim();
    if (!name) return toast("Please enter your name.", true);

    try {
        const data = await api("/user/profile", {
            method: "PUT",
            body: {
                name,
                email,
                phone: $("profilePhone").value.trim(),
                organization: $("profileOrg").value.trim(),
                bio: $("profileBio").value.trim()
            }
        });
        applyUser({ ...data.user, id: data.user._id });
        toast("Profile updated.");
    } catch (err) {
        toast(err.message, true);
    }
});

// ---------------- INIT ----------------

checkAuthSession();
