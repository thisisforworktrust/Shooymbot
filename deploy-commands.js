const { REST, Routes, SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType } = require("discord.js");
require("dotenv").config();

const commands = [

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if the bot is alive")
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    )
    .setIntegrationTypes(
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Make the bot say something")
    .addStringOption(option =>
      option.setName("text")
        .setDescription("What should I say?")
        .setRequired(true)
    )
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    )
    .setIntegrationTypes(
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Shows info about you")
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    )
    .setIntegrationTypes(
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ),

  // 🤖 AI COMMAND
  new SlashCommandBuilder()
    .setName("ai")
    .setDescription("Talk to the AI (remembers conversation)")
    .addStringOption(option =>
      option.setName("prompt")
        .setDescription("What do you want to say?")
        .setRequired(true)
    )
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    )
    .setIntegrationTypes(
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    )

].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("Registering global slash commands (servers + DMs)...");
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("Slash commands registered successfully.");
  } catch (err) {
    console.error("Error registering commands:", err);
  }
})();
