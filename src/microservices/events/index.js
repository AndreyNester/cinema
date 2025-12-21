const express = require("express");
const { Kafka, logLevel } = require("kafkajs");

const PORT = process.env.PORT || 8082;
const BROKERS = (process.env.KAFKA_BROKERS || "kafka:9092")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const TOPICS = {
  user: "user-events",
  payment: "payment-events",
  movie: "movie-events",
};

const app = express();

// ВАЖНО: чтобы не получать 400 на не-JSON/пустом теле
// Разрешаем и JSON, и пустое тело, и text — потом сами разрулим.
app.use(express.json({ limit: "1mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "1mb" }));

function safeParseBody(req) {
  // Если пришёл JSON — express.json положит объект
  if (req.body && typeof req.body === "object") return req.body;

  // Если пришёл text/plain или что-то странное — попробуем распарсить как JSON
  if (typeof req.body === "string" && req.body.trim() !== "") {
    try {
      return JSON.parse(req.body);
    } catch {
      // не JSON — сохраним как строку
      return { raw: req.body };
    }
  }

  // Если тело пустое — ок, вернём пустой объект
  return {};
}

const kafka = new Kafka({
  clientId: "cinemaabyss-events-service",
  brokers: BROKERS,
  logLevel: logLevel.NOTHING,
});

const producer = kafka.producer();

function makeEnvelope(type, payload) {
  return {
    type,
    timestamp: new Date().toISOString(),
    payload,
  };
}

// --- Health check, как требуют тесты
app.get("/api/events/health", (req, res) => {
  res.status(200).json({ status: true });
});

function makeHandler(type) {
  const topic = TOPICS[type];
  return async (req, res) => {
    try {
      const payload = safeParseBody(req);
      const envelope = makeEnvelope(type, payload);

      await producer.send({
        topic,
        messages: [
          {
            key: type,
            value: JSON.stringify(envelope),
          },
        ],
      });

      // Как требуют тесты:
      res.status(201).json({ status: "success" });
    } catch (e) {
      console.error("Kafka produce error:", e);
      res.status(500).json({ status: "error" });
    }
  };
}

app.post("/api/events/movie", makeHandler("movie"));
app.post("/api/events/user", makeHandler("user"));
app.post("/api/events/payment", makeHandler("payment"));

async function startConsumers() {
  const consumer = kafka.consumer({ groupId: "cinemaabyss-events-consumer" });

  await consumer.connect();
  console.log("Consumer connected");

  for (const topic of Object.values(TOPICS)) {
    await consumer.subscribe({ topic, fromBeginning: true });
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const key = message.key ? message.key.toString() : "";
      const value = message.value ? message.value.toString() : "";
      console.log(`EVENT topic=${topic} key=${key} value=${value}`);
    },
  });
}

async function main() {
  await producer.connect();
  console.log("Producer connected. Brokers:", BROKERS.join(","));

  startConsumers().catch((e) => {
    console.error("Consumer crashed:", e);
    process.exit(1);
  });

  app.listen(PORT, () => {
    console.log(`events-service listening on :${PORT}`);
  });

  const shutdown = async () => {
    console.log("Shutting down...");
    try {
      await producer.disconnect();
    } catch (_) {}
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error("Startup failed:", e);
  process.exit(1);
});
