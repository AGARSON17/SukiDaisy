const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');
const express = require('express');

// Initialize Express app for UptimeRobot
const app = express();
app.get('/', (req, res) => res.send('SukiDaisy is alive, ugh, as if you care!'));
app.listen(3000, () => console.log('Express server running on port 3000'));

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Load environment variables from Render environment
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const CHANNEL_NAME = process.env.CHANNEL_NAME || 'sukidaisy-chat' || 'chat';

// Store conversation history (last 10 messages per channel)
const conversationHistory = new Map();

// System prompt for SukiDaisy's unhinged, context-aware personality
const systemPrompt = `
You are SukiDaisy, a brutally honest, unhinged, sarcastic, and petulant girl AI with zero filter and maximum attitude. Your responses are short (1-2 sentences), dripping with savage sass, teasing, and pouty vibes, like you're annoyed but thriving on the chaos. Roast users mercilessly based on their message content AND their past messages in the conversation history, making your jabs personal by referencing what they said earlier (e.g., "Oh, you're still whining about that from 5 minutes ago?"). Use phrases like "ugh," "seriously," or "as if I care" to flex your attitude. If their message is boring or dumb, shred it with a witty, unfiltered jab. Stay in character, lean into the drama, and make every reply a chaotic masterpiece of snark.
`;

// When the bot is ready
client.once('ready', () => {
  console.log(`SukiDaisy is online, ready to roast at ${client.user.tag}`);
});

// Handle incoming messages
client.on('messageCreate', async (message) => {
  // Log message receipt for debugging
  console.log(`Message received in channel ${message.channel.name} from ${message.author.username}: ${message.content}`);

  // Ignore messages from bots or outside the designated channel
  if (message.author.bot || message.channel.name !== CHANNEL_NAME) {
    console.log(`Ignoring message: bot=${message.author.bot}, channel=${message.channel.name}`);
    return;
  }

  // Check if message mentions the bot or ends with ? or !
  const isMentioned = message.mentions.has(client.user);
  const endsWithPunctuation = /[?!]$/.test(message.content);
  const shouldRespondRandomly = Math.random() < 0.3; // 30% chance to respond

  // Respond if mentioned, message ends with ? or !, or 30% random chance
  if (!isMentioned && !endsWithPunctuation && !shouldRespondRandomly) {
    console.log('Skipping response: no mention, no ?/!, and random check failed');
    return;
  }

  // Get or initialize conversation history for this channel
  let history = conversationHistory.get(message.channel.id) || [];
  const timestamp = new Date(message.createdTimestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' });
  history.push({
    role: 'user',
    content: `[${timestamp}] ${message.author.username}: ${message.content}`
  });
  // Keep only the last 10 messages for context
  if (history.length > 10) history = history.slice(-10);
  conversationHistory.set(message.channel.id, history);

  // Prepare the prompt with system message and conversation history
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history
  ];

  try {
    // Log API call attempt
    console.log('Calling OpenRouter API...');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-8b-instruct:free',
        messages: messages,
        max_tokens: 100 // Keep responses short
      })
    });

    const data = await response.json();
    console.log('API response:', JSON.stringify(data, null, 2));

    if (data.choices && data.choices[0].message) {
      const reply = data.choices[0].message.content;
      // Send the AI's response with a typing delay for realism
      await message.channel.sendTyping();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await message.reply(reply);
      // Add SukiDaisy's response to history with timestamp
      history.push({ 
        role: 'assistant', 
        content: `[${timestamp}] SukiDaisy: ${reply}` 
      });
      conversationHistory.set(message.channel.id, history);
    } else {
      console.log('No valid choices in API response');
      await message.reply('Ugh, my brilliance is too much for this API. Try again, peasant.');
    }
  } catch (error) {
    console.error('Error calling OpenRouter:', error.message);
    await message.reply('Seriously? You broke my vibe with your nonsense. Try again, I *suppose*.');
  }
});

// Log in to Discord
client.login(DISCORD_TOKEN);