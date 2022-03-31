import { ServerType } from './typings';
import type { Config, DiscordConfig } from './typings';

// Discord bot configuration (optional)
export const discordConfig: DiscordConfig = {
	// A bot token for Discord, obtained from https://discord.com/developers/applications
	token: 'DISCORD_BOT_TOKEN_HERE',
	// The prefix to use for commands
	prefix: '!',
	// Whether or not to use a Discord bot
	enabled: false,
	// A list of user IDs that are allowed to execute commands
	whitelist: ['USER_ID', 'USER_ID'],
};

const config: Config = {
	// Your OpenAI key from https://openai.com/ (optional)
	openai_key: undefined,
	// A list of Minecraft usernames that are allowed to execute commands
	whitelist: ['username', 'username'],
	// The user to send money to when `MONEY_THRESHOLD` is reached
	autopay_to: 'username',
	// The version of Minecraft to use
	version: '1.12.2',
	// The server to join. Supported values:
	// ONYX, RUBY, AMBER, CHAOS, GENESIS, ORIGINS
	server: ServerType.ONYX,
	// A list of Minecraft accounts to use
	accounts: [
		{
			alias: 'username',
			username: 'handle@gmail.com',
			password: 'password',
			auth: 'mojang',
		},
		{
			alias: 'username',
			username: 'handle@outlook.com',
			password: 'password',
			auth: 'microsoft',
		},
	],
	// Whether to log information in the console
	log: true,
	// Whether to start fishing immediately
	fish_on_join: true,
	// Whether to sneak while fishing
	sneak_while_fishing: false,
	// Whether to upgrade the fishing rod automatically
	upgrade_fishing_rod_automatically: true,
	// Whether to listen for the rod cast sound when casting
	smart_casting: true,
};

export default config;
