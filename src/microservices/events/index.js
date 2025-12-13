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
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => res.status(200).send("ok"));

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

function makeHandler(type) {
  const topic = TOPICS[type];
  return async (req, res) => {
    try {
      // Любой JSON из тела считаем payload
      const payload = req.body;
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

      res.status(202).json({ status: "queued" });
    } catch (e) {
      console.error("Kafka produce error:", e);
      res.status(502).json({ error: "kafka_write_failed" });
    }
  };
}

app.post("/api/events/user", makeHandler("user"));
app.post("/api/events/payment", makeHandler("payment"));
app.post("/api/events/movie", makeHandler("movie"));

async function startConsumers() {
  // Один consumer на все топики (можно и по одному — но так проще)
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
  // producer
  await producer.connect();
  console.log("Producer connected. Brokers:", BROKERS.join(","));

  // consumers
  startConsumers().catch((e) => {
    console.error("Consumer crashed:", e);
    process.exit(1);
  });

  app.listen(PORT, () => {
    console.log(`events-service listening on :${PORT}`);
  });

  // graceful shutdown
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
