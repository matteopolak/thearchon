import { ServerType } from './typings';
import type { Config, DiscordConfig } from './typings';

export const discordConfig: DiscordConfig = {
	token: 'DISCORD_BOT_TOKEN_HERE',
	prefix: '!',
	enabled: false,
	whitelist: ['USER_ID', 'USER_ID'],
};

const config: Config = {
	whitelist: ['main_account', 'anoter_account'],
	autopay_to: 'main_account',
	version: '1.12.2',
	server: ServerType.ONYX,
	accounts: [
		{
			alias: 'username1',
			username: 'email1@gmail.com',
			password: 'password1',
			auth: 'mojang',
		},
		{
			alias: 'username2',
			username: 'microsoft@outlook.com',
			password: 'password2',
			auth: 'microsoft',
		},
	],
	log: true,
	fishOnJoin: true,
	sneakWhileFishing: false,
	upgradeFishingRodAutomatically: true,
};

export default config;
