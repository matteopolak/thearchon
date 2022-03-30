import { ServerType } from './typings';
import type { Config, DiscordConfig } from './typings';

export const discordConfig: DiscordConfig = {
	token: 'DISCORD_BOT_TOKEN_HERE',
	prefix: '!',
	enabled: false,
	whitelist: ['USER_ID', 'USER_ID'],
};

const config: Config = {
	whitelist: ['username', 'username'],
	autopay_to: 'username',
	version: '1.12.2',
	server: ServerType.ONYX,
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
	log: true,
	fishOnJoin: true,
	sneakWhileFishing: false,
	upgradeFishingRodAutomatically: true,
};

export default config;
