import { ServerType } from './typings';
import type { Config } from './typings';

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
