import { ServerType } from './typings';
import type { Config } from './typings';

const config: Config = {
	fishOnJoin: true,
	server: ServerType.ONYX,
	sneakWhileFishing: false,
	upgradeFishingRodAutomatically: true,
	whitelist: ['main_account', 'anoter_account'],
	autopay_to: 'main_account',
	log: true,
	version: '1.12.2',
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
};

export default config;
