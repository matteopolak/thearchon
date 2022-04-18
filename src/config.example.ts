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
	channels: {
		// The ID of the channel to send notifications to
		// This is required when `notify_on_mention` is `true`
		notifications: 'CHANNEL_ID',
	},
};

const config: Config = {
	// Your OpenAI key from https://openai.com/ (optional)
	openai_key: undefined,
	// Your Wit.ai key from https://wit.ai (optional)
	witai_key: undefined,
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
		// Fisher account example
		{
			// The alias to use for the account
			alias: 'username',
			// The email of the account
			username: 'handle@gmail.com',
			// The password for the account
			password: 'password',
			// The authentication service to use. Either `mojang`, `microsoft`, or `thealtening`
			auth: 'mojang',
			// The type of bot to use. Either `storage` or `fisher`
			// `storage`: Automatically purchases items from the shop and stores them
			// `fisher`: Auto-fishing capabilities
			type: 'fisher',
			// The proxy to use (optional)
			// Protocols: `socks4` or `socks5`
			proxy: 'socks5://192.168.1.1:5050',
			// The channels where commands will affect this bot (optionak)
			// Only used when Discord integration is enabled
			channels: ['CHANNEL_ID', 'CHANNEL_ID'],
			// The port on which to host an instance of `prismarine-viewer` (optional)
			viewer_port: 3000,
			// The homes to use (optional)
			homes: {
				// The home that is set at the fishing location
				fishing: 'fishing',
				// The home that is set at the selling location
				// (optional if the NPC is in range of the bot)
				forest: 'forest',
			},
		},
		// Storage account example
		{
			alias: 'username',
			username: 'handle@gmail.com',
			password: 'password',
			auth: 'mojang',
			// The type of bot to use. Either `storage` or `fisher`
			// `storage`: Automatically purchases items from the shop and stores them
			// `fisher`: Auto-fishing capabilities
			type: 'storage',
			// The method of storing items. Either `enderchest` or `drop`
			// `enderchest`: Stores items in the bot's enderchest
			// `drop`: Drops items to a player in the whitelist at `/home storage`
			storage: 'enderchest',
			// The slots to click while in `/shop`, in order
			// For example, [14, 32] would purchase `Iron Golem Spawner` as the `Spawners`
			// category is in slot 14, and `Iron Golem Spawner` is slot 32 in that category
			instructions: [14, 32],
			// The price of the item to buy
			price: 4_000_000,
			// The homes to use (optional)
			homes: {
				// The home that is set at the drop location
				drop: 'storage',
			},
		},
		// TheAltening account example
		{
			alias: 'username',
			// The email (TheAltening token) of the account
			username: 'aaaa-aaaaa@alt.com',
			// Must use `thealtening` as the auth service
			auth: 'thealtening',
			type: 'fisher',
		},
		// TheAltening automatic account example
		{
			alias: 'username',
			// Using `undefined` will automatically create a token
			username: undefined,
			// Must use `thealtening` as the auth service
			auth: 'thealtening',
			type: 'fisher',
		},
	],
	// Fishing-related settings
	fishing: {
		// Whether to start fishing immediately
		fish_on_join: false,
		// Whether to sneak while fishing
		sneak_while_fishing: false,
		// Whether to upgrade the fishing rod automatically
		upgrade_fishing_rod_automatically: true,
		// Whether to stop fishing when the bot is mentioned in chat or sent a direct message
		stop_fishing_on_mention: false,
		// Whether to stop fishing while staff are vanished
		pause_fishing_while_staff_hidden: true,
		// whether to stop fishing while staff are online
		pause_fishing_while_staff_online: true,
		// Settings for random movement
		random_movement: {
			// Whether to enable random movement
			enabled: false,
			// A list of recordings to use for random movement
			// Creating a recording:
			// 1. Create a new single-player world and open it to LAN
			// 2. Run `npm run record -- <port>`
			// 3. Follow instructions in-game
			// 4. Use file name as the name of the recording (feel free to rename them to something else!)
			recordings: [],
			// Chance of random movement happening (0 to 1)
			chance: 0.05,
		},
	},
	// Whether to log information in the console
	log: true,
	// Whether to notify all users in `whitelist` (on Discord) when the bot is mentioned
	notify_on_mention: false,
	// Whether to look around when the bot's position or rotation is changed externally
	react_to_external_move: false,
	// Whether to minimize memory usage
	minimize_memory_usage: false,
};

export default config;
