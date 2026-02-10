const { Client, GatewayIntentBits, Partials } = require("discord.js");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

/* ================= GEMINI SETUP ================= */

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" }); // DO NOT CHANGE THIS

// Simple memory storage (userId => chat history)
const memory = new Map();

async function askGemini(userId, prompt) {
  if (!memory.has(userId)) memory.set(userId, []);

  const history = memory.get(userId);

  history.push({ role: "user", parts: [{ text: prompt }] });

  const result = await model.generateContent({
    contents: history,
  });

  const response = await result.response;
  const text = response.text();

  history.push({ role: "model", parts: [{ text }] });

  // Limit memory to last 10 messages to prevent overload
  if (history.length > 20) history.splice(0, history.length - 20);

  return text;
}

/* ================= DISCORD BOT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

client.once("clientReady", () => {
  console.log(`🤖 Bot online as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await interaction.deferReply();

    if (interaction.commandName === "ping") {
      return interaction.editReply("Pong 🏓");
    }

    if (interaction.commandName === "say") {
      const text = interaction.options.getString("text");
      return interaction.editReply(text);
    }

    if (interaction.commandName === "userinfo") {
      return interaction.editReply(
        `Your username is **${interaction.user.username}**`
      );
    }

    if (interaction.commandName === "ai") {
      const prompt = interaction.options.getString("prompt");

      const reply = await askGemini(interaction.user.id, prompt);

      // Discord message limit safety
      if (reply.length > 1900) {
        return interaction.editReply(reply.slice(0, 1900) + "...");
      }

      return interaction.editReply(reply);
    }

  } catch (error) {
    console.error("Interaction error:", error);
    if (interaction.deferred || interaction.replied) {
      interaction.editReply("⚠️ AI had a brain lag. Try again.");
    }
  }
});

client.login(process.env.TOKEN);
