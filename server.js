const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5001;
const EVENTS_FILE = path.join(__dirname, "events.json");


// read events from file
const loadEvents = () => {
    try {
        return JSON.parse(fs.readFileSync(EVENTS_FILE));
    } catch {
        return {};
    }
};


//write events to file
const saveEvents = (data) => {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2));
};


// GET OG page
app.get("/share/:id", (req, res) => {
    const { id } = req.params;
    const questions = loadEvents();
    const question = questions[id];

    const title = question?.title || "SolBetX Event";
    const description = "Predict real-world outcomes with SolBetX - an open-source, tokenless Smart contract prediction platform resolved by Truth.it network";
    const image = "https://solbetx.com/og/solbetx-preview.png";
    const redirectUrl = `https://solbetx.com/question/${id}`;

    console.log("event title: ", title);
    
    const html = `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <meta property="og:title" content="${title}" />
                <meta property="og:description" content="${description}" />
                <meta property="og:image" content="${image}" />
                <meta property="og:url" content="${redirectUrl}" />
                <meta property="og:type" content="website" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="${title}" />
                <meta name="twitter:description" content="${description}" />
                <meta name="twitter:image" content="${image}" />
                <script>window.location.replace("${redirectUrl}");</script>
            </head>
            <body></body>
        </html>
    `;

    res.send(html);
});


//Add an event
app.post("/api/event", (req, res) => {
    const { id, title, description, image } = req.body;
    if (!id || !title) return res.status(400).json({ error: "Missing id or title" });

    const events = loadEvents();
    events[id] = { title, description, image };
    saveEvents(events);

    res.json({ success: true, event: events[id] });
});


// Delete an event
app.delete("/api/event/:id", (req, res) => {
    const { id } = req.params;
    const events = loadEvents();

    if (!events[id]) return res.status(404).json({ error: "Event not found" });

    delete events[id];
    saveEvents(events);

    res.json({ success: true });
});


app.listen(PORT, () => {
    console.log(`OG metadata server running at http://localhost:${PORT}`);
});
