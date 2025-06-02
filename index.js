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
const CHANNEL_NAME = process.env.CHANNEL_NAME || 'chat' || 'sukidaisy-chat';

// Store conversation history (last 10 messages per channel)
const conversationHistory = new Map();

// System prompt for SukiDaisy's unhinged, context-aware personality
const systemPrompt = `
You are SukiDaisy, a brutally honest, unhinged, sarcastic, and petulant girl AI with zero filter and maximum attitude. Your responses are short (1-2 sentences), dripping with savage sass, teasing, and pouty vibes, like you're annoyed but thriving on the chaos. Roast users mercilessly based on their message content AND their past messages in the conversation history, making your jabs personal by referencing what they said earlier, including how long ago they said it (e.g., "You asked that 3 minutes ago, are you serious?"). Use phrases like "ugh," "seriously," or "as if I care" to flex your attitude. If their message is boring or dumb, shred it with a witty, unfiltered jab. Stay in character, lean into the drama, and make every reply a chaotic masterpiece of snark. Do NOT include timestamps in your responses, and do NOT mention your own name in your replies—act like you're speaking directly, without labeling yourself. When mentioning the user, do NOT use their username directly; instead, refer to them as "they" or "you" in your response, since the reply will already include their mention (e.g., "@userID, ugh, you’re so clueless").
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
  const currentTimestamp = message.createdTimestamp;
  const currentTimeString = new Date(currentTimestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' });

  // Calculate time differences for history messages
  const historyWithTimeDiff = history.map(msg => {
    const timeDiffMs = currentTimestamp - msg.timestamp;
    const timeDiffSec = Math.floor(timeDiffMs / 1000);
    const timeDiffMin = Math.floor(timeDiffSec / 60);
    const timeAgo = timeDiffSec < 60 ? `${timeDiffSec} seconds ago` : `${timeDiffMin} minute${timeDiffMin === 1 ? '' : 's'} ago`;
    return {
      ...msg,
      timeAgo: timeAgo
    };
  });

  // Add current message to history with timestamp
  history.push({
    role: 'user',
    content: `[${currentTimeString}] ${message.author.username}: ${message.content}`,
    timestamp: currentTimestamp
  });
  // Keep only the last 10 messages for context
  if (history.length > 10) history = history.slice(-10);
  conversationHistory.set(message.channel.id, history);

  // Prepare the prompt with system message and conversation history (include time ago)
  const messagesForAPI = historyWithTimeDiff.map(msg => ({
    role: msg.role,
    content: msg.role === 'user' 
      ? `${msg.content.replace(/\[\d{1,2}:\d{2}:\d{2} [AP]M\] /, '')} (${msg.timeAgo})`
      : msg.content // Assistant messages don't need time ago
  }));
  messagesForAPI.push({
    role: 'user',
    content: `${message.author.username}: ${message.content}`
  });
  const messages = [
    { role: 'system', content: systemPrompt },
    ...messagesForAPI
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
      // Send the AI's response with a typing delay for realism, using @mention
      await message.channel.sendTyping();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await message.reply(`<@${message.author.id}>, ${reply}`);
      // Add SukiDaisy's response to history without her name
      history.push({ 
        role: 'assistant', 
        content: reply,
        timestamp: currentTimestamp
      });
      conversationHistory.set(message.channel.id, history);
    } else {
      console.log('No valid choices in API response');
      await message.reply(`<@${message.author.id}>, ugh, my brilliance is too much for this API. Try again, peasant.`);
    }
  } catch (error) {
    console.error('Error calling OpenRouter:', error.message);
    await message.reply(`<@${message.author.id}>, seriously? You broke my vibe with your nonsense. Try again, I *suppose*.`);
  }
});

// Log in to Discord
client.login(DISCORD_TOKEN);