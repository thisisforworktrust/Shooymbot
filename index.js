const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
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

  // Limit memory to last 20 messages to prevent overload
  if (history.length > 20) history.splice(0, history.length - 20);

  return text;
}

/* ================= SNAKE GAME STORAGE ================= */
const snakeGames = new Map(); // channelId => game state

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

  // --- HANDLE SLASH COMMANDS ---
  if (interaction.isChatInputCommand()) {
    try {

      if (interaction.commandName === "ping") {
        await interaction.deferReply();
        return interaction.editReply("Pong 🏓");
      }

      if (interaction.commandName === "say") {
        await interaction.deferReply();
        const text = interaction.options.getString("text");
        return interaction.editReply(text);
      }

      if (interaction.commandName === "userinfo") {
        await interaction.deferReply();
        return interaction.editReply(
          `Your username is **${interaction.user.username}**`
        );
      }

      if (interaction.commandName === "ai") {
        await interaction.deferReply();
        const prompt = interaction.options.getString("prompt");

        const reply = await askGemini(interaction.user.id, prompt);

        // Discord message limit safety
        if (reply.length > 1900) {
          return interaction.editReply(reply.slice(0, 1900) + "...");
        }

        return interaction.editReply(reply);
      }

      // --- NEW SNAKE COMMAND ---
      if (interaction.commandName === "snake") {
        if (snakeGames.has(interaction.channel.id)) {
          return interaction.reply({ content: "Game already running!", ephemeral: true });
        }

        const size = 10;

        const game = {
          boardSize: size,
          snake: [{ x: 5, y: 5 }],
          direction: "RIGHT",
          food: spawnFood(size),
          score: 0,
          interval: null,
          interaction: interaction // Store interaction for edits
        };

        snakeGames.set(interaction.channel.id, game);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("up").setLabel("⬆️").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("left").setLabel("⬅️").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("down").setLabel("⬇️").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("right").setLabel("➡️").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("fuck you dylan").setLabel("Fuck you dylan").setStyle(ButtonStyle.Danger),
        );

        await interaction.reply({
          content: render(game),
          components: [row]
        });

        // Start the game loop
        game.interval = setInterval(() => updateGame(interaction.channel.id), 800);
      }

    } catch (error) {
      console.error("Interaction error:", error);
      if (interaction.deferred || interaction.replied) {
        try { await interaction.editReply("⚠️ Bot had a hiccup."); } catch (e) {}
      }
    }
  }

  // --- HANDLE BUTTONS (SNAKE CONTROLS) ---
  else if (interaction.isButton()) {
    const game = snakeGames.get(interaction.channel.id);
    if (!game) return;

    if (interaction.customId === "stop") {
      clearInterval(game.interval);
      snakeGames.delete(interaction.channel.id);
      return interaction.update({ content: "Game stopped.", components: [] });
    }

    // Direction Logic
    if (interaction.customId === "up" && game.direction !== "DOWN") game.direction = "UP";
    if (interaction.customId === "down" && game.direction !== "UP") game.direction = "DOWN";
    if (interaction.customId === "left" && game.direction !== "RIGHT") game.direction = "LEFT";
    if (interaction.customId === "right" && game.direction !== "LEFT") game.direction = "RIGHT";

    await interaction.deferUpdate(); // acknowledge button press
  }
});

/* ================= SNAKE HELPER FUNCTIONS ================= */
function updateGame(channelId) {
  const game = snakeGames.get(channelId);
  if (!game) return;

  const head = { ...game.snake[0] };

  if (game.direction === "UP") head.y--;
  if (game.direction === "DOWN") head.y++;
  if (game.direction === "LEFT") head.x--;
  if (game.direction === "RIGHT") head.x++;

  // Wall collision
  if (head.x < 0 || head.y < 0 || head.x >= game.boardSize || head.y >= game.boardSize) {
    return endGame(channelId);
  }

  // Self collision
  if (game.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
    return endGame(channelId);
  }

  game.snake.unshift(head);

  // Eat food
  if (head.x === game.food.x && head.y === game.food.y) {
    game.score++;
    game.food = spawnFood(game.boardSize);
  } else {
    game.snake.pop();
  }

  try {
    game.interaction.editReply({ content: render(game) });
  } catch (e) {
    endGame(channelId);
  }
}

function endGame(channelId) {
  const game = snakeGames.get(channelId);
  if (!game) return;

  clearInterval(game.interval);
  try {
    game.interaction.editReply({ content: `Game Over!\nScore: ${game.score}`, components: [] });
  } catch (e) {}

  snakeGames.delete(channelId);
}

function spawnFood(size) {
  return {
    x: Math.floor(Math.random() * size),
    y: Math.floor(Math.random() * size)
  };
}

function render(game) {
  let board = "";

  for (let y = 0; y < game.boardSize; y++) {
    for (let x = 0; x < game.boardSize; x++) {

      if (game.snake[0].x === x && game.snake[0].y === y) board += "🖕"; // Head
      else if (game.snake.some(seg => seg.x === x && seg.y === y)) board += "🟨"; // Body
      else if (game.food.x === x && game.food.y === y) board += "🍎"; // Food
      else board += "⬛"; // Empty space
    }
    board += "\n";
  }

  return `Score: ${game.score}\n\`\`\`\n${board}\`\`\``;
}

client.login(process.env.TOKEN);
