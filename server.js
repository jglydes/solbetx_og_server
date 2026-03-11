const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const dotenv = require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const mongoose = require("mongoose");
const Subscription = require("./models/Subscription");

console.log("env: ", process.env)
mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.once("open", () => {
  console.log("MongoDB connected");
});

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
    const shareUrl = `https://solbetx.com/share/${id}`;

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
                <meta property="og:url" content="${shareUrl}" />
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

app.post("/api/btcpay/webhook", express.raw({ type: 'application/json' }), (req, res) => {
    const signature = req.headers['btcpay-sig'];
    const rawBody = req.body;
    console.log("rawBou9dy", rawBody);
    try {
        const payload = JSON.parse(rawBody.toString()); 
        console.log(payload);
    } catch (err) {
        console.error("Webhook JSON parse error:", err.message);
        return res.status(400).send("Invalid JSON");
    }

    console.log(payload);
    res.sendStatus(200);
});


/**
 * Notifications: Subscription endpoints
 */
app.post("/api/subscriptions", async (req, res) => {
  try {
    const { site, email, eventId, types } = req.body;

    const normalizedEmail = String(email || "").trim().toLowerCase();

    const allowedSites = ["truthit", "solbetx", "predictsol"];
    const allowedTypes = [
      "commit_end",
      "reveal_end",
      "general_updates",
      "event_updates",
      "result"
    ];

    const cleanTypes = Array.isArray(types)
      ? types.filter((t) => allowedTypes.includes(t))
      : [];

    if (!allowedSites.includes(site) || !normalizedEmail || cleanTypes.length === 0) {
      return res.status(400).json({ error: "Missing or invalid required fields" });
    }

    const subscription = await Subscription.findOneAndUpdate(
      {
        site,
        email: normalizedEmail,
        eventId: eventId || null
      },
      {
        $addToSet: { types: { $each: cleanTypes } },
        $set: { active: true }
      },
      {
        new: true,
        upsert: true
      }
    );

    res.json({ success: true, subscription });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Subscription failed" });
  }
});

app.post("/api/subscriptions/unsubscribe", async (req, res) => {
  try {
    const { site, email, eventId, type } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    const sub = await Subscription.findOne({
      site,
      email: normalizedEmail,
      eventId: eventId || null
    });

    if (!sub) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    if (type) {
      sub.types = sub.types.filter((t) => t !== type);
      if (sub.types.length === 0) {
        sub.active = false;
      }
    } else {
      sub.active = false;
    }

    await sub.save();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unsubscribe failed" });
  }
});

app.get("/api/subscriptions", async (req, res) => {
  try {
    const { site, type, eventId } = req.query;
    const filter = { active: true };

    if (site) filter.site = site;
    if (type) filter.types = type;
    if (eventId) filter.eventId = eventId;

    const emails = await Subscription.distinct("email", filter);

    res.json({
      success: true,
      count: emails.length,
      emails
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

app.get("/api/notifications/truthit-upcoming", async (req, res) => {
  try {
    const mod = await import("./getUpcomingTruthNotifications.mjs");
    const jobs = await mod.getUpcomingTruthNotifications();

    res.json({
      success: true,
      count: jobs.length,
      jobs
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch upcoming truth notifications"
    });
  }
});


app.listen(PORT, '0.0.0.0', () => {
    console.log(`OG metadata server running at http://localhost:${PORT}`);
});